/* global CodeMirror */
'use strict';

function renderEditor(id, type, size){
    const editorConfig = {
        lineNumbers: true,
        lineWrapping:true,
    };
    if (type === 'html'){
        editorConfig.mode = 'htmlmixed';
    } else if (type === 'javascript') {
        editorConfig.mode = { name: 'javascript', json: false };
    }
    let editor = null;

    const $textarea = $('#' + id);
    editor = CodeMirror.fromTextArea($textarea[0], editorConfig);
    editor.setSize(null, size);
    if (type === 'html'){
        $('#' + id + '-edit-tabs a[data-toggle="tab"]').on('shown.bs.tab', function(e) {
            if ($(e.target).attr('aria-controls') === id + '-preview'){
                $('#' + id + '-preview-frame').html($.parseHTML(editor.getValue()));
            }
        });
    }

}

