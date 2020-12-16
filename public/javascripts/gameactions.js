/* global _ showScriptEditor */
let nextIndex = 0;
const nextActions = {};

$(function(){
    // For Form
    $('.remove-area-btn').confirmation({
        title: 'Delete this Area'
    }).on('click', removeArea);
    $('#add-area-btn').on('click', addArea);
    $('#area-new').hide();
    $('.add-action-btn').on('click', addAction);
    $('#action-new-new').hide();

    $('.remove-action-btn').confirmation({
        title: 'Delete this Action'
    }).on('click', removeAction);

    $('.delete-btn').confirmation({
        title: 'Delete this item'
    }).on('click', deleteItem);
    $('.action-link').hide();
    $('.action-text').hide();

    showAllActions();

    $('.action-type-select').on('change', function(e){
        showAction($(this).closest('.action-row'));
    });
    $('.document-type-select').on('change', function(e){
        showText($(this).closest('.action-row'));
    });
    $('.document-location-select').on('change', function(e){
        showText($(this).closest('.action-row'));
    });


    $('.link-select').on('select2:selecting', getOldLinkName);
    $('.link-select').on('change', updateAreaName);

    $('#action-new-new').find('.editor').Code;
});

function removeArea(e){
    const $this = $(this);
    e.preventDefault();
    e.stopPropagation();
    $this.closest('.list-group-item').remove();
}

function removeAction(e){
    const $this = $(this);
    e.preventDefault();
    e.stopPropagation();
    $this.closest('.action-row').remove();
}

function addArea(e){
    const $this = $(this);
    e.preventDefault();

    const $new = $('#area-new').clone();
    const id = nextIndex++;
    $new.attr('id', `area-new-${id}`);

    $new.find('#gamestate_map_area_name-new')
        .attr('required', true)
        .attr('id', 'gamestate_map_area_name-new-' + id)
        .attr('name', `gamestate[map][new-${id}][name]`);
    $new.find('label [for=gamestate_map_area_name-new]')
        .attr('for', 'gamestate_map_area_name-new-' + id);

    $new.find('#gamestate_map_area_link_id-new')
        .attr('required', true)
        .attr('id', 'gamestate_map_area_link_id-new-' + id)
        .attr('name', `gamestate[map][new-${id}][link_id]`);
    $new.find('label [for=gamestate_map_area_link_id-new]')
        .attr('for', 'gamestate_map_area_link_id-new-' + id);

    $new.find('#gamestate_map_area_coords-new')
        .attr('required', true)
        .attr('id', 'gamestate_map_area_coords-new-' + id)
        .attr('name', `gamestate[map][new-${id}][coords]`);
    $new.find('label [for=gamestate_map_area_coords-new]')
        .attr('for', 'gamestate_map_area_coords-new-' + id);


    $new.find('#gamestate_map_area_shape-new')
        .attr('required', true)
        .attr('id', 'gamestate_map_area_shape-new-' + id)
        .attr('name', `gamestate[map][new-${id}][shape]`);
    $new.find('label [for=gamestate_map_area_shape-new]')
        .attr('for', 'gamestate_map_area_shape-new-' + id);

    $new.find('.remove-area-btn').confirmation({
        title: 'Delete this Area'
    }).on('click', removeArea);

    $new.find('.add-action-btn')
        .attr('data-area', 'new-' + id)
        .on('click', addAction);

    $new.find('select').select2({
        theme:'bootstrap4',
        minimumResultsForSearch: 6,
        width:'resolve'
    });
    $new.appendTo('#gamestate_map');
    $new.show();

}

async function deleteItem(e){
    e.preventDefault();
    const $this = $(this);
    const url = $this.attr('url');
    const result = await fetch(url, {method:'DELETE'});
    if($this.attr('data-back')){
        location = $this.attr('data-back');
    }
}

function showAllActions(){
    $('.action-row').each(function(index) {
        showAction($(this));
        showText($(this));
    });
}

function showAction($row) {
    const type = $row.find('.action-type-select').val();
    $row.find('.action-link').hide();
    $row.find('.action-text').hide();
    $row.find('.action-transition').hide();
    $row.find('.action-image').hide();
    $row.find('.action-script').hide();
    switch(type){
        case 'link':
            $row.find('.action-link').show();
            break;
        case 'text':
            $row.find('.action-text').show();
            break;
        case 'transition':
            $row.find('.action-transition').show();
            break;
        case 'image':
            $row.find('.action-image').show();
            break;
        case 'script':
            $row.find('.action-script').show();
            break;

    }
}

function showText($row) {
    const type = $row.find('.action-type-select').val();
    if (type !== 'text') { return; }
    const document_id = $row.find('.document-type-select').val();
    if (document_id === '-1'){
        $row.find('.document-contents').show();
    } else {
        $row.find('.document-contents').hide();
    }
    const location = $row.find('.document-location-select').val();
    if (location === 'inline'){
        $row.find('.document-duration').show();
    } else {
        $row.find('.document-duration').hide();
    }
}

function addAction(e){
    const $this = $(this);
    e.preventDefault();
    e.stopPropagation();
    const areaId = $this.attr('data-area');
    const $new = $('#action-new-new').clone();
    if (!_.has(nextActions, areaId)){
        nextActions[areaId] = 0;
    }
    const id = nextActions[areaId]++;
    const prefix = $new.data('prefix');
    const namePrefix = $new.data('nameprefix');
    $new.attr('id', `action-${areaId}-new-${id}`);


    // Update all action fields
    $new.find('.action-input').each(function(e) {
        const $input = $(this);
        const fieldtype = $input.data('fieldtype');
        $input.attr('id', `${prefix}-${areaId}-action-new-${id}-${fieldtype}`);
        $input.attr('name', `${namePrefix}[actions][new-${id}][${fieldtype}]`);
        if ($this.data('required')){
            $input.attr('required', true);
        }
    });

    // Update all action labels
    $new.find('.action-input-label').each(function(e) {
        const $label = $(this);
        const fieldtype = $label.data('fieldtype');
        $label.attr('for', `${prefix}-${areaId}-action-new-${id}-${fieldtype}`);
    });

    $new.find('.script-editor-btn').on('click', showScriptEditor);
    $new.find('.remove-action-btn').confirmation({
        title: 'Delete this Action'
    }).on('click', removeAction);


    $new.find('.action-type-select').on('change', function(e){
        showAction($(this).closest('.action-row'));
    });

    $new.find('.document-type-select').on('change', function(e){
        showText($(this).closest('.action-row'));
    });
    $new.find('.document-location-select').on('change', function(e){
        showText($(this).closest('.action-row'));
    });

    $new.find('select').select2({
        theme:'bootstrap4',
        minimumResultsForSearch: 6,
        width:'resolve'
    });

    if ($this.data('target')){
        $new.appendTo($($this.data('target')));
    } else {
        $new.appendTo($this.closest('.list-group-item'));
    }
    $new.show();
    showAction($new);
    showText($new);
}

function getOldLinkName(e){
    const $this = $(this);
    $this.attr('data-old-name', $this.find(':selected').text());
}

function updateAreaName(e){
    const $this = $(this);
    const name =  $this.find(':selected').text();
    const $nameField = $this.closest('.area-config').find('.area-name');
    if ($nameField.val() === $this.attr('data-old-name')){
        $nameField.val(name);
    }
}