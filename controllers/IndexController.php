<?php
use Pimcore\Tool;
use Pimcore\Model\Object;

class CopyVariants_IndexController extends \Pimcore\Controller\Action\Admin
{
    /**
     * This function overridden to send two more
     * parameters in response - sourceParentId, sourceType
     *
     * @author Prateek Suhane
     * @return string
     */
    public function copyInfoAction()
    {
        $transactionId = time();
        $pasteJobs = array();
        
        Tool\Session::useSession(function ($session) use($transactionId)
        {
            $session->$transactionId = array(
                "idMapping" => array()
            );
        }, "pimcore_copy");
        
        $object = Object::getById($this->getParam("sourceId"));
        if ($this->getParam("type") == "recursive" || $this->getParam("type") == "recursive-update-references") {
            
            // first of all the new parent
            $pasteJobs[] = array(
                array(
                    "url" => "/admin/object/copy",
                    "params" => array(
                        "sourceId" => $this->getParam("sourceId"),
                        "targetId" => $this->getParam("targetId"),
                        "sourceParentId" => "" . $object->getParentId(),
                        "sourceType" => $object->getType(),
                        "type" => "child",
                        "transactionId" => $transactionId,
                        "saveParentId" => true
                    )
                )
            );
            
            if ($object->hasChilds(array(
                Object\AbstractObject::OBJECT_TYPE_OBJECT,
                Object\AbstractObject::OBJECT_TYPE_FOLDER,
                Object\AbstractObject::OBJECT_TYPE_VARIANT
            ))) {
                // get amount of childs
                $list = new Object\Listing();
                $list->setCondition("o_path LIKE '" . $object->getFullPath() . "/%'");
                $list->setOrderKey("LENGTH(o_path)", false);
                $list->setOrder("ASC");
                $list->setObjectTypes(array(
                    Object\AbstractObject::OBJECT_TYPE_OBJECT,
                    Object\AbstractObject::OBJECT_TYPE_FOLDER,
                    Object\AbstractObject::OBJECT_TYPE_VARIANT
                ));
                $childIds = $list->loadIdList();
                
                if (count($childIds) > 0) {
                    foreach ($childIds as $id) {
                        $pasteJobs[] = array(
                            array(
                                "url" => "/admin/object/copy",
                                "params" => array(
                                    "sourceId" => $id,
                                    "targetParentId" => $this->getParam("targetId"),
                                    "sourceParentId" => $this->getParam("sourceId"),
                                    "type" => "child",
                                    "transactionId" => $transactionId
                                )
                            )
                        );
                    }
                }
            }
            
            // add id-rewrite steps
            if ($this->getParam("type") == "recursive-update-references") {
                for ($i = 0; $i < (count($childIds) + 1); $i ++) {
                    $pasteJobs[] = array(
                        array(
                            "url" => "/admin/object/copy-rewrite-ids",
                            "params" => array(
                                "transactionId" => $transactionId,
                                "_dc" => uniqid()
                            )
                        )
                    );
                }
            }
        } else 
            if ($this->getParam("type") == "child" || $this->getParam("type") == "replace") {
                // the object itself is the last one
                $pasteJobs[] = array(
                    array(
                        "url" => "/admin/object/copy",
                        "params" => array(
                            "sourceId" => $this->getParam("sourceId"),
                            "targetId" => $this->getParam("targetId"),
                            "sourceParentId" => "" . $object->getParentId(),
                            "sourceType" => $object->getType(),
                            "type" => $this->getParam("type"),
                            "transactionId" => $transactionId
                        )
                    )
                );
            }
        
        $this->_helper->json(array(
            "pastejobs" => $pasteJobs
        ));
    }

    /**
     * This function overridden to always unpublish pasted variant.
     *
     * @author Prateek Suhane
     * @return string
     */
    public function copyAction()
    {
        $this->_objectService = new Object\Service($this->getUser());
        $success = false;
        $message = "";
        $sourceId = intval($this->getParam("sourceId"));
        $source = Object::getById($sourceId);
        $source->setPublished(false);
        
        $session = Tool\Session::get("pimcore_copy");
        
        $targetId = intval($this->getParam("targetId"));
        if ($this->getParam("targetParentId")) {
            $sourceParent = Object::getById($this->getParam("sourceParentId"));
            
            // this is because the key can get the prefix "_copy" if the target does already exists
            if ($session->{$this->getParam("transactionId")}["parentId"]) {
                $targetParent = Object::getById($session->{$this->getParam("transactionId")}["parentId"]);
            } else {
                $targetParent = Object::getById($this->getParam("targetParentId"));
            }
            
            $targetPath = preg_replace("@^" . $sourceParent->getFullPath() . "@", $targetParent . "/", $source->getPath());
            $target = Object::getByPath($targetPath);
        } else {
            $target = Object::getById($targetId);
        }
        
        if ($target->isAllowed("create")) {
            $source = Object::getById($sourceId);
            if ($source != null) {
                try {
                    if ($this->getParam("type") == "child") {
                        $newObject = $this->_objectService->copyAsChild($target, $source);
                        
                        $session->{$this->getParam("transactionId")}["idMapping"][(int) $source->getId()] = (int) $newObject->getId();
                        
                        // this is because the key can get the prefix "_copy" if the target does already exists
                        if ($this->getParam("saveParentId")) {
                            $session->{$this->getParam("transactionId")}["parentId"] = $newObject->getId();
                            Tool\Session::writeClose();
                        }
                    }
                    
                    $success = true;
                } catch (\Exception $e) {
                    \Logger::err($e);
                    $success = false;
                    $message = $e->getMessage() . " in object " . $source->getFullPath() . " [id: " . $source->getId() . "]";
                }
            } else {
                \Logger::error("could not execute copy/paste, source object with id [ $sourceId ] not found");
                $this->_helper->json(array(
                    "success" => false,
                    "message" => "source object not found"
                ));
            }
        } else {
            \Logger::error("could not execute copy/paste because of missing permissions on target [ " . $targetId . " ]");
            $this->_helper->json(array(
                "error" => false,
                "message" => "missing_permission"
            ));
        }
        
        $this->_helper->json(array(
            "success" => $success,
            "message" => $message
        ));
    }
}
