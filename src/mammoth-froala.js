(function(factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['jquery', 'mammoth'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node/CommonJS
        module.exports = function(root, jQuery, mammoth) {
            if (jQuery === undefined) {
                // require('jQuery') returns a factory that requires window to
                // build a jQuery instance, we normalize how we use modules
                // that require this pattern but the window provided is a noop
                // if it's defined (how jquery works)
                if (typeof window !== 'undefined') {
                    jQuery = require('jquery');
                } else {
                    jQuery = require('jquery')(root);
                }
            }
            factory(jQuery, mammoth);
            return jQuery;
        };
    } else {
        // Browser globals
        if (!jQuery) {
            throw new Error('mammoth-froala requires jQuery to be loaded first');
        }

        if (!mammoth) {
            throw new Error('mammoth-froala requires mammoth to be loaded first');
        }

        factory(jQuery, mammoth);
    }
}(function($, mammoth) {

    'use strict';

    $.extend($.FroalaEditor.POPUP_TEMPLATES, {
        'mammoth.import': '[_BUTTONS_][_UPLOAD_LAYER_]'
    });

    // Extend defaults.
    $.extend($.FroalaEditor.DEFAULTS, {
        mammothInsertMethod: 'set',
        mammothUploadParam: 'mammoth',
        mammothUploadParams: {},
        mammothMaxSize: 10 * 1024 * 1024,
        mammothAllowedTypes: ['*'],
        mammothInsertButtons: ['mammothBack', '|']
    });


    $.FroalaEditor.PLUGINS.mammoth = function(editor) {
        function showImportPopup() {
            var $btn = editor.$tb.find('.fr-command[data-cmd="importFile"]');

            var $popup = editor.popups.get('mammoth.import');
            if (!$popup) {
                $popup = _initImportPopup();
            }

            if (!$popup.hasClass('fr-active')) {
                editor.popups.refresh('mammoth.import');
                editor.popups.setContainer('mammoth.import', editor.$tb);

                var left = $btn.offset().left + $btn.outerWidth() / 2;
                var top = $btn.offset().top + (editor.opts.toolbarBottom ? 0 : $btn.outerHeight());
                editor.popups.show('mammoth.import', left, top, $btn.outerHeight());
            }
        }

        /**
         * Show error message to the user.
         */
        function _showErrorMessage(message) {
            var $popup = editor.popups.get('mammoth.import');
            var $layer = $popup.find('.fr-file-progress-bar-layer');
            $layer.addClass('fr-error');
            $layer.find('h3').text(message);
        }

        /**
         * Insert the uploaded mammoth.
         */
        function insertHtml(result, response) {
            var html = result.value;
            editor.edit.on();

            // Focus in the editor.
            editor.events.focus(true);
            editor.selection.restore();

            // Insert the link.
            editor.html.set(html);

            // Get the file.
            var $file = editor.$el.find('#fr-imported-file');
            $file.removeAttr('id');
            editor.popups.hide('mammoth.import');
            editor.undo.saveStep();
            editor.events.trigger('mammoth.imported', [$file, response]);
        }

        function convert(arrayBuffer) {
            return mammoth.convertToHtml({
                    arrayBuffer: arrayBuffer
                }, editor.opts.mammothOptions)
                .then(insertHtml)
                .done();
        }

        function upload(files) {
            // Check if we should cancel the file upload.
            if (editor.events.trigger('file.beforeUpload', [files]) === false) {
                return false;
            }

            // Make sure we have what to upload.
            if (typeof files !== 'undefined' && files.length > 0) {
                var reader = new FileReader();
                reader.onload = function(loadEvent) {
                    editor.mammoth.convert(loadEvent.target.result);
                };

                reader.readAsArrayBuffer(files[0]);
            }
        }

        function _bindInsertEvents($popup) {
            // Drag over the dropable area.
            editor.events.$on($popup, 'dragover dragenter', '.fr-file-upload-layer', function() {
                $(this).addClass('fr-drop');
                return false;
            }, true);

            // Drag end.
            editor.events.$on($popup, 'dragleave dragend', '.fr-file-upload-layer', function() {
                $(this).removeClass('fr-drop');
                return false;
            }, true);

            // Drop.
            editor.events.$on($popup, 'drop', '.fr-file-upload-layer', function(e) {
                e.preventDefault();
                e.stopPropagation();

                $(this).removeClass('fr-drop');

                var dt = e.originalEvent.dataTransfer;
                if (dt && dt.files) {
                    var inst = $popup.data('instance') || editor;
                    inst.mammoth.upload(dt.files);
                }
            }, true);

            editor.events.$on($popup, 'change', '.fr-file-upload-layer input[type="file"]', function() {
                if (this.files) {
                    var inst = $popup.data('instance') || editor;
                    inst.mammoth.upload(this.files);
                }

                // Else IE 9 case.

                // Chrome fix.
                $(this).val('');
            }, true);
        }

        function _initImportPopup(delayed) {
            if (delayed) {
                return true;
            }

            // Image buttons.
            var file_buttons = '';
            file_buttons = '<div class="fr-buttons">' + editor.button.buildList(editor.opts.mammothInsertButtons) + '</div>';

            // File upload layer.
            var upload_layer = '';
            upload_layer = '<div class="fr-file-upload-layer fr-layer fr-active" id="fr-file-upload-layer-' + editor.id + '"><strong>' + editor.language.translate('Drop file') + '</strong><br>(' + editor.language.translate('or click') + ')<div class="fr-form"><input type="file" name="' + editor.opts.mammothUploadParam + '" accept="/*" tabIndex="-1"></div></div>';

            var template = {
                buttons: file_buttons,
                upload_layer: upload_layer
            };

            // Set the template in the popup.
            var $popup = editor.popups.create('mammoth.import', template);

            _bindInsertEvents($popup);

            return $popup;
        }

        function _drop(e) {
            // Check if we are dropping files.
            var dt = e.originalEvent.dataTransfer;
            if (dt && dt.files && dt.files.length) {
                var file = dt.files[0];
                if (file && typeof file.type !== 'undefined') {
                    // Dropped file is an file that we allow.
                    if (mammoth.type.indexOf('image') < 0 && (editor.opts.mammothAllowedTypes.indexOf(mammoth.type) >= 0 || editor.opts.mammothAllowedTypes.indexOf('*') >= 0)) {
                        editor.markers.remove();
                        editor.markers.importAtPoint(e.originalEvent);
                        editor.$el.find('.fr-marker').replaceWith($.FroalaEditor.MARKERS);

                        // Hide popups.
                        editor.popups.hideAll();

                        // Show the file import popup.
                        var $popup = editor.popups.get('mammoth.import');
                        if (!$popup) {
                            $popup = _initImportPopup();
                        }
                        editor.popups.setContainer('mammoth.import', $(editor.opts.scrollableContainer));
                        editor.popups.show('mammoth.import', e.originalEvent.pageX, e.originalEvent.pageY);

                        // Upload files.
                        upload(dt.files);

                        // Cancel anything else.
                        e.preventDefault();
                        e.stopPropagation();

                        return false;
                    }
                }
            }
        }

        function _initEvents() {
            // Drop inside the editor.
            editor.events.on('drop', _drop);

            editor.events.$on(editor.$win, 'keydown', function(e) {
                var key_code = e.which;
                var $popup = editor.popups.get('mammoth.import');
                if ($popup && key_code === $.FroalaEditor.KEYCODE.ESC) {
                    $popup.trigger('abortUpload');
                }
            });

            editor.events.on('destroy', function() {
                var $popup = editor.popups.get('mammoth.import');
                if ($popup) {
                    $popup.trigger('abortUpload');
                }
            });
        }

        function back() {
            editor.events.disableBlur();
            editor.selection.restore();
            editor.events.enableBlur();

            editor.popups.hide('mammoth.import');
            editor.toolbar.showInline();
        }

        /*
         * Initialize.
         */
        function _init() {
            _initEvents();
            _initImportPopup(true);
        }

        return {
            _init: _init,
            showImportPopup: showImportPopup,
            upload: upload,
            convert: convert,
            insertHtml: insertHtml,
            back: back
        };
    };

    // Insert file button.
    $.FroalaEditor.DefineIcon('importFile', {
        NAME: 'upload'
    });
    $.FroalaEditor.RegisterCommand('importFile', {
        title: 'Import Word Doc',
        undo: false,
        focus: true,
        refreshAfterCallback: false,
        popup: true,
        callback: function() {
            if (!this.popups.isVisible('mammoth.import')) {
                this.mammoth.showImportPopup();
            } else {
                if (this.$el.find('.fr-marker')) {
                    this.events.disableBlur();
                    this.selection.restore();
                }
                this.popups.hide('mammoth.import');
            }
        },
        plugin: 'mammoth'
    });

    $.FroalaEditor.DefineIcon('mammothBack', {
        NAME: 'arrow-left'
    });
    $.FroalaEditor.RegisterCommand('mammothBack', {
        title: 'Back',
        undo: false,
        focus: false,
        back: true,
        refreshAfterCallback: false,
        callback: function() {
            this.mammoth.back();
        },
        refresh: function($btn) {
            if (!this.opts.toolbarInline) {
                $btn.addClass('fr-hidden');
                $btn.next('.fr-separator').addClass('fr-hidden');
            } else {
                $btn.removeClass('fr-hidden');
                $btn.next('.fr-separator').removeClass('fr-hidden');
            }
        }
    });

    $.FroalaEditor.RegisterCommand('fileDismissError', {
        title: 'OK',
        callback: function() {
            this.mammoth.hideProgressBar(true);
        }
    });
}));
