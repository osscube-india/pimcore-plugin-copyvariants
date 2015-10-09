pimcore.registerNS("pimcore.plugin.copyvariants");

pimcore.plugin.copyvariants = Class.create(pimcore.plugin.admin, {
    getClassName: function() {
        return "pimcore.plugin.copyvariants";
    },

    initialize: function() {
        pimcore.plugin.broker.registerPlugin(this);
    },
 
    pimcoreReady: function (params,broker){
        // alert("CopyVariants Ready!");
    	element = Ext.getCmp("pimcore_panel_tree_objects");
    	element.loader.baseAttrs.listeners.contextmenu = this.onTreeNodeContextmenu;
    	
    	Ext.override(pimcore.object.tree, {
    		//This function overridden to get two more parameters in response - sourceParentId, sourceType
    		pasteInfo: function (type) {    			
    	        pimcore.helpers.addTreeNodeLoadingIndicator("object", this.id);

    	        Ext.Ajax.request({
    	            //url: "/admin/object/copy-info/",
    	            url: "/plugin/CopyVariants/index/copy-info/",
    	            params: {
    	                targetId: this.id,
    	                sourceId: this.attributes.reference.cacheObjectId,
    	                type: type
    	            },
    	            success: this.attributes.reference.paste.bind(this)
    	        });
    	    },
    	    
    	    //This function overridden to always unpublish pasted variants.
	    	paste: function (response) {
	
	            try {
	                var res = Ext.decode(response.responseText);	                
	                	
	                if (res.pastejobs) {            	
	                	if(res.pastejobs[0][0].params.sourceType == "variant" &&  res.pastejobs[0][0].params.sourceParentId != res.pastejobs[0][0].params.targetId){	                		
	                		Ext.MessageBox.show({
	                            title:t('error'),
	                            msg: 'Please copy variant to the same parent.',
	                            buttons: Ext.Msg.OK ,
	                            icon: Ext.MessageBox.ERROR
	                    	});
	                		
	                		pimcore.helpers.removeTreeNodeLoadingIndicator("object", this.id);
	                		return false;
	                	}
	                	
	                	if(res.pastejobs[0][0].params.sourceType == "variant" && res.pastejobs[0][0].params.type == "replace"){
	                		Ext.MessageBox.show({
	                            title:t('error'),
	                            msg: 'Not allowed to paste content of variant.',
	                            buttons: Ext.Msg.OK ,
	                            icon: Ext.MessageBox.ERROR
	                    	});
	                		
	                		pimcore.helpers.removeTreeNodeLoadingIndicator("object", this.id);
	                		return false;
	                	}
	                	
	                	//To always unpublish pasted variants.
	                	if(res.pastejobs[0][0].params.sourceType == "variant"){
	                		res.pastejobs[0][0].url = "/plugin/CopyVariants/index/copy/";
	                	}
	                	
	                    this.pasteProgressBar = new Ext.ProgressBar({
	                        text: t('initializing')
	                    });
	
	                    this.pasteWindow = new Ext.Window({
	                        title: t("paste"),
	                        layout: 'fit',
	                        width: 500,
	                        bodyStyle: "padding: 10px;",
	                        closable: false,
	                        plain: true,
	                        modal: true,
	                        items: [this.pasteProgressBar]
	                    });
	
	                    this.pasteWindow.show();
	
	
	                    var pj = new pimcore.tool.paralleljobs({
	                        success: function () {
	
	                            try {
	                                this.attributes.reference.pasteComplete(this);
	                            } catch (e) {
	                                console.log(e);
	                                pimcore.helpers.showNotification(t("error"), t("error_pasting_object"), "error");
	                                this.parentNode.reload();
	                            }
	                        }.bind(this),
	                        update: function (currentStep, steps, percent) {
	                            if (this.pasteProgressBar) {
	                                var status = currentStep / steps;
	                                this.pasteProgressBar.updateProgress(status, percent + "%");
	                            }
	                        }.bind(this),
	                        failure: function (message) {
	                            this.pasteWindow.close();
	                            this.pasteProgressBar = null;
	
	                            pimcore.helpers.showNotification(t("error"), t("error_pasting_object"), "error", t(message));
	                            this.parentNode.reload();
	                        }.bind(this),
	                        jobs: res.pastejobs
	                    });
	                } else {
	                    throw "There are no pasting jobs";
	                }
	            } catch (e) {
	                console.log(e);
	                Ext.MessageBox.alert(t('error'), e);
	                this.attributes.reference.pasteComplete(this);
	            }
	        }
    	});
    },
    
    onTreeNodeContextmenu: function () {
        this.select();

        var menu = new Ext.menu.Menu();


        /**
         * case-insensitive string comparison
         * @param f_string1
         * @param f_string2
         * @returns {number}
         */
        function strcasecmp(f_string1, f_string2) {
            var string1 = (f_string1 + '').toLowerCase();
            var string2 = (f_string2 + '').toLowerCase();

            if (string1 > string2) {
                return 1;
            } else if (string1 == string2) {
                return 0;
            }

            return -1;
        }

        /**
         *
         * @param str1
         * @param str2
         * @returns {number}
         */
        function getEqual(str1, str2) {
            var count = 0;
            for (var c = 0; c < str1.length; c++) {
                if (strcasecmp(str1[c], str2[c]) !== 0)
                    break;

                count++;
            }

            if(count > 0) {
                lastSpace = str1.search(/ [^ ]*$/);

                if((lastSpace > 0) && (lastSpace < count)) {
                    count = lastSpace;
                }
            }


            if (str1[count] == " " || (typeof str1[count] == 'undefined')) {
                return count;
            } else {
                return 0;
            }
        };

        var matchCount = 3;
        var classGroups = {};
        var currentClass = '', nextClass = '', count = 0, group = '', lastGroup = '';

        var object_types = pimcore.globalmanager.get("object_types_store");
        for (var i = 0; i < object_types.getCount(); i++) {
            //
            currentClass = object_types.getAt(i);
            nextClass = object_types.getAt(i + 1);

            // check last group
            count = getEqual(lastGroup, currentClass.get("translatedText"));
            if (count <= matchCount) {
                // check new class to group with
                if (!nextClass) {
                    // this is the last class
                    count = currentClass.get("translatedText").length;
                }
                else {
                    // check next class to group with
                    count = getEqual(currentClass.get("translatedText"), nextClass.get("translatedText"));
                    if (count <= matchCount) {
                        // match is to low, use the complete name
                        count = currentClass.get("translatedText").length;
                    }
                }

                group = currentClass.get("translatedText").substring(0, count);
            }
            else {
                // use previous group
                group = lastGroup;
            }


            // add class to group
            if (!classGroups[ group ]) {
                classGroups[ group ] = [];
            }
            classGroups[ group ].push(currentClass);
            lastGroup = group;
        }
        ;


        var objectMenu = {
            objects: [],
            importer: [],
            ref: this
        };
        var tmpMenuEntry;
        var tmpMenuEntryImport;
        var record, tmp;

        for (var groupName in classGroups) {

            if (classGroups[groupName].length > 1) {
                // handle group

                tmpMenuEntry = {
                    text: groupName,
                    iconCls: "pimcore_icon_folder",
                    hideOnClick: false,
                    menu: {
                        items: []
                    }
                };
                tmpMenuEntryImport = {
                    text: groupName,
                    iconCls: "pimcore_icon_folder",
                    handler: this.attributes.reference.importObjects.bind(this, classGroups[groupName][0].get("id"), classGroups[groupName][0].get("text")),
                    menu: {
                        items: []
                    }
                };

                // add items
                for (var i = 0; i < classGroups[groupName].length; i++) {
                    record = classGroups[groupName][i];
                    if (this.attributes.reference.config.allowedClasses == "all" || in_array(record.get("id"),
                        this.attributes.reference.config.allowedClasses)) {

                        /* == menu entry: create new object == */

                        // create menu item
                        tmp = {
                            text: record.get("translatedText"),
                            iconCls: "pimcore_icon_object_add",
                            handler: this.attributes.reference.addObject.bind(this, record.get("id"), record.get("text"))
                        };

                        // add special icon
                        if (record.get("icon")) {
                            tmp.icon = record.get("icon");
                            tmp.iconCls = "";
                        }

                        tmpMenuEntry.menu.items.push(tmp);


                        /* == menu entry: import object == */

                        // create menu item
                        tmp = {
                            text: record.get("translatedText"),
                            iconCls: "pimcore_icon_object_import",
                            handler: this.attributes.reference.importObjects.bind(this, record.get("id"), record.get("text"))
                        };

                        // add special icon
                        if (record.get("icon")) {
                            tmp.icon = record.get("icon");
                            tmp.iconCls = "";
                        }

                        tmpMenuEntryImport.menu.items.push(tmp);
                    }
                }

                objectMenu.objects.push(tmpMenuEntry);
                objectMenu.importer.push(tmpMenuEntryImport);
            }
            else {
                record = classGroups[groupName][0];

                if (this.attributes.reference.config.allowedClasses == "all" || in_array(record.get("id"),
                    this.attributes.reference.config.allowedClasses)) {

                    /* == menu entry: create new object == */
                    tmpMenuEntry = {
                        text: record.get("translatedText"),
                        iconCls: "pimcore_icon_object_add",
                        handler: this.attributes.reference.addObject.bind(this, record.get("id"), record.get("text"))
                    };

                    if (record.get("icon")) {
                        tmpMenuEntry.icon = record.get("icon");
                        tmpMenuEntry.iconCls = "";
                    }

                    objectMenu.objects.push(tmpMenuEntry);


                    /* == menu entry: import object == */
                    tmpMenuEntryImport = {
                        text: record.get("translatedText"),
                        iconCls: "pimcore_icon_object_import",
                        handler: this.attributes.reference.importObjects.bind(this, record.get("id"), record.get("text"))
                    };

                    if (record.get("icon")) {
                        tmpMenuEntryImport.icon = record.get("icon");
                        tmpMenuEntryImport.iconCls = "";
                    }

                    objectMenu.importer.push(tmpMenuEntryImport);
                }
            }
        };

        var isVariant = this.attributes.type == "variant";

        if (this.attributes.permissions.create) {
            if (!isVariant) {
                menu.add(new Ext.menu.Item({
                    text: t('add_object'),
                    iconCls: "pimcore_icon_object_add",
                    hideOnClick: false,
                    menu: objectMenu.objects
                }));
            }

            if (this.attributes.allowVariants) {
                menu.add(new Ext.menu.Item({
                    text: t("add_variant"),
                    iconCls: "pimcore_icon_tree_variant",
                    handler: this.attributes.reference.createVariant.bind(this)
                }));
            }

            if (!isVariant) {
                //if (this.attributes.type == "folder") {
                menu.add(new Ext.menu.Item({
                    text: t('add_folder'),
                    iconCls: "pimcore_icon_folder_add",
                    handler: this.attributes.reference.addFolder.bind(this)
                }));
                //}


                menu.add({
                    text: t('import_csv'),
                    hideOnClick: false,
                    iconCls: "pimcore_icon_object_csv_import",
                    menu: objectMenu.importer
                });

                //paste
                var pasteMenu = [];

                if (this.attributes.reference.cacheObjectId && this.attributes.permissions.create) {
                    pasteMenu.push({
                        text: t("paste_recursive_as_childs"),
                        iconCls: "pimcore_icon_paste",
                        handler: this.attributes.reference.pasteInfo.bind(this, "recursive")
                    });
                    pasteMenu.push({
                        text: t("paste_recursive_updating_references"),
                        iconCls: "pimcore_icon_paste",
                        handler: this.attributes.reference.pasteInfo.bind(this, "recursive-update-references")
                    });
                    pasteMenu.push({
                        text: t("paste_as_child"),
                        iconCls: "pimcore_icon_paste",
                        handler: this.attributes.reference.pasteInfo.bind(this, "child")
                    });


                    if (this.attributes.type != "folder") {
                        pasteMenu.push({
                            text: t("paste_contents"),
                            iconCls: "pimcore_icon_paste",
                            handler: this.attributes.reference.pasteInfo.bind(this, "replace")
                        });
                    }
                }
            }

            if (!isVariant) {
                if (this.attributes.reference.cutObject && this.attributes.permissions.create) {
                    pasteMenu.push({
                        text: t("paste_cut_element"),
                        iconCls: "pimcore_icon_paste",
                        handler: function () {
                            this.attributes.reference.pasteCutObject(this.attributes.reference.cutObject,
                                this.attributes.reference.cutParentNode, this, this.attributes.reference.tree);
                            this.attributes.reference.cutParentNode = null;
                            this.attributes.reference.cutObject = null;
                        }.bind(this)
                    });
                }

                if (pasteMenu.length > 0) {
                    menu.add(new Ext.menu.Item({
                        text: t('paste'),
                        iconCls: "pimcore_icon_paste",
                        hideOnClick: false,
                        menu: pasteMenu
                    }));
                }
            }
        }

        //To enable copy variant functionality
        if (this.id != 1 && this.attributes.permissions.view) {
            menu.add(new Ext.menu.Item({
                text: t('copy'),
                iconCls: "pimcore_icon_copy",
                handler: this.attributes.reference.copy.bind(this)
            }));
        }
        if (!isVariant) {
            //cut
            if (this.id != 1 && !this.attributes.locked && this.attributes.permissions.rename) {
                menu.add(new Ext.menu.Item({
                    text: t('cut'),
                    iconCls: "pimcore_icon_cut",
                    handler: this.attributes.reference.cut.bind(this)
                }));
            }
        }

        //publish
        if (this.attributes.type != "folder" && !this.attributes.locked) {
            if (this.attributes.published && this.attributes.permissions.unpublish) {
                menu.add(new Ext.menu.Item({
                    text: t('unpublish'),
                    iconCls: "pimcore_icon_tree_unpublish",
                    handler: this.attributes.reference.publishObject.bind(this, this.attributes.id, 'unpublish')
                }));
            } else if (!this.attributes.published && this.attributes.permissions.publish) {
                menu.add(new Ext.menu.Item({
                    text: t('publish'),
                    iconCls: "pimcore_icon_tree_publish",
                    handler: this.attributes.reference.publishObject.bind(this, this.attributes.id, 'publish')
                }));
            }
        }


        if (this.attributes.permissions["delete"] && this.id != 1 && !this.attributes.locked) {
            menu.add(new Ext.menu.Item({
                text: t('delete'),
                iconCls: "pimcore_icon_delete",
                handler: this.attributes.reference.remove.bind(this)
            }));
        }

        if (this.attributes.permissions.create) {
            menu.add(new Ext.menu.Item({
                text: t('search_and_move'),
                iconCls: "pimcore_icon_search_and_move",
                handler: this.attributes.reference.searchAndMove.bind(this, this.id)
            }));
        }

        if (this.attributes.permissions.rename && this.id != 1 && !this.attributes.locked) {
            menu.add(new Ext.menu.Item({
                text: t('rename'),
                iconCls: "pimcore_icon_edit_key",
                handler: this.attributes.reference.editKey.bind(this)
            }));
        }


        if (this.id != 1) {
            var user = pimcore.globalmanager.get("user");
            if (user.admin) { // only admins are allowed to change locks in frontend

                var lockMenu = [];
                if (this.attributes.lockOwner) { // add unlock
                    lockMenu.push({
                        text: t('unlock'),
                        iconCls: "pimcore_icon_lock_delete",
                        handler: function () {
                            this.attributes.reference.updateObject(this.attributes.id, {locked: null}, function () {
                                this.attributes.reference.tree.getRootNode().reload();
                            }.bind(this));
                        }.bind(this)
                    });
                } else {
                    lockMenu.push({
                        text: t('lock'),
                        iconCls: "pimcore_icon_lock_add",
                        handler: function () {
                            this.attributes.reference.updateObject(this.attributes.id, {locked: "self"}, function () {
                                this.attributes.reference.tree.getRootNode().reload();
                            }.bind(this));
                        }.bind(this)
                    });

                    lockMenu.push({
                        text: t('lock_and_propagate_to_childs'),
                        iconCls: "pimcore_icon_lock_add_propagate",
                        handler: function () {
                            this.attributes.reference.updateObject(this.attributes.id, {locked: "propagate"},
                                function () {
                                    this.attributes.reference.tree.getRootNode().reload();
                                }.bind(this));
                        }.bind(this)
                    });
                }

                if(this.attributes["locked"]) {
                    // add unlock and propagate to children functionality
                    lockMenu.push({
                        text: t('unlock_and_propagate_to_children'),
                        iconCls: "pimcore_icon_lock_delete",
                        handler: function () {
                            Ext.Ajax.request({
                                url: "/admin/element/unlock-propagate",
                                params: {
                                    id: this.id,
                                    type: "object"
                                },
                                success: function () {
                                    this.parentNode.reload();
                                }.bind(this)
                            });
                        }.bind(this)
                    });
                }

                menu.add(new Ext.menu.Item({
                    text: t('lock'),
                    iconCls: "pimcore_icon_lock",
                    hideOnClick: false,
                    menu: lockMenu
                }));
            }
        }


        if (this.reload) {
            menu.add(new Ext.menu.Item({
                text: t('refresh'),
                iconCls: "pimcore_icon_reload",
                handler: this.reload.bind(this)
            }));
        }

        menu.show(this.ui.getAnchor());
    }
});

var copyvariantsPlugin = new pimcore.plugin.copyvariants();

