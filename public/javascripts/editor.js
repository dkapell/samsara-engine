/* global CodeMirror */
'use strict';
let popupEditor = null;
$(function(){
    $('.script-editor-btn').on('click', showScriptEditor);
    $('#editor-save').on('click', updateField);
});

function renderEditor(id, type, size){
    const editorConfig = {
        lineNumbers: true,
        lineWrapping:true,
        autoRefresh:true,
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
    editor.refresh();
    return editor;
}

function capitalize(string){
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function showScriptEditor(e){
    const $this = $(this);
    e.preventDefault();
    e.stopPropagation();
    const $modal = $('#editorModal');
    const $input = $this.closest('.input-group').find('.script-input');
    const editor = $('#js-editor').next('.CodeMirror').get(0).CodeMirror;
    $('#js-editor').data('sourcefield', $input.attr('id'));
    $modal.find('.modal-title').text(`Javascript Editor - ${capitalize($input.data('fieldtype'))}`);
    editor.setValue($input.val());
    $modal.modal('show');
    $('#editorModal').one('shown.bs.modal', function(){
        editor.refresh();
    });
}

async function updateField(e){
    e.preventDefault();
    e.stopPropagation();

    const contents = $('#js-editor').next('.CodeMirror').get(0).CodeMirror.getValue();

    const verified = await verifyScript(contents);
    if (!verified.verified){
        $('#editor-errors').text(verified.errors);
        $('#js-editor').addClass('is-invalid');
    } else {
        $('#editor-errors').text('');
        $('#js-editor').removeClass('is-invalid');

        const id = $('#js-editor').data('sourcefield');
        const $field = $(`#${id}`);
        const $display = $field.closest('.input-group').find('.script-display');

        $field.val(verified.script);
        if (verified.script){
            const lines = verified.script.split('\n');
            $display.val(lines[0] + (lines.length > 1?`...(+${lines.length-1} more lines)`:''));
        } else {
            $display.val(null);
        }

        $('#editorModal').modal('hide');
    }
}


async function verifyScript(script){
    const result = await fetch('/game/script/verify', {
        method:'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            script: script
        })
    });
    return await result.json();
}
