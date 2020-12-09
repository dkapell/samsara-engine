/* global _ */
let link_idLocked = false;
let nextIndex = 0;
const nextActions = {};
let areaTimers = {};

$(function(){
    //For Show
    $('img[usemap]').rwdImageMaps();
    $('.map').maphilight({
        wrapClass:true,
        shadow:true,
        strokeWidth:3,
        strokeColor: '3498db',
        fillColor: '000000',
        fillOpacity: 0.2,
    });
    $('area').on('click', toggleLock);
    $('area').on('mouseover', showLink);
    $('area').on('mouseout', clearLink);
    $('.imageHolder').on('click', showAreas);

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

    $('.link-select').on('select2:selecting', getOldLinkName);
    $('.link-select').on('change', updateAreaName);


});

function showLink(e){
    const $area = $(this);
    const areaId = $area.data('area');
    if(!link_idLocked){
        $('#link-name').text($area.data('name'));
        $(`#area-detail-${areaId}`).show();
        if (areaTimers[areaId]){
            clearTimeout(areaTimers[areaId]);
            delete areaTimers[areaId];
        }
    }
}

function clearLink(e){
    const $area = $(this);
    const areaId = $area.data('area');
    if(!link_idLocked){
        $('#link-name').html('&nbsp;');
        $(`#area-detail-${$(this).attr('data-area')}`).hide();
        const data = $area.data('maphilight') || {};
        data.alwaysOn = false;
        $area.data('maphilight', data).trigger('alwaysOn.maphilight');
        $(`#area-detail-${areaId}`).hide();
    }
}

function toggleLock(e){
    e.preventDefault();
    e.stopPropagation();
    link_idLocked = !link_idLocked;
    if (!link_idLocked){
        $('.area-detail-card').hide();
        $(`#area-detail-${$(this).attr('data-area')}`).show();
    }
}
function showAreas(e){
    e.preventDefault();
    for (const area in areaTimers){
        clearTimeout(areaTimers[area]);
    }
    areaTimers = {};
    $('area').each(function(i) {
        const $area = $(this);
        const areaId = $area.data('area');
        var data = $area.data('maphilight') || {};
        data.alwaysOn = true;
        $area.data('maphilight', data).trigger('alwaysOn.maphilight');
        const timeout = setTimeout(function(){
            data.alwaysOn = false;
            $area.data('maphilight', data).trigger('alwaysOn.maphilight');
            $(`#area-detail-${areaId}`).hide();
        }, 2000);
        areaTimers[areaId] = timeout;
    });
}


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
    });
}

function showAction($row) {
    const type = $row.find('.action-type-select').val();
    $row.find('.action-link').hide();
    $row.find('.action-text').hide();
    $row.find('.action-transition').hide();
    $row.find('.action-image').hide();
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

    }
}

function addAction(e){
    const $this = $(this);
    e.preventDefault();
    const areaId = $this.attr('data-area');
    const $new = $('#action-new-new').clone();
    if (!_.has(nextActions, areaId)){
        nextActions[areaId] = 0;
    }
    const id = nextActions[areaId]++;
    $new.attr('id', `action-${areaId}-new-${id}`);


    $new.find('#gamestate_map_area-new-action-new-type')
        .attr('required', true)
        .attr('id', `gamestate_map_area-${areaId}-action-new-${id}-type`)
        .attr('name', `gamestate[map][${areaId}][actions][new-${id}][type]`);
    $new.find('label [for=gamestate_map_area-new-action-new-type]')
        .attr('for', `gamestate_map_area-${areaId}-action-new-${id}-type`);

    $new.find('#gamestate_map_area-new-action-new-link_id')
        .attr('id', `gamestate_map_area-${areaId}-action-new-${id}-link_id`)
        .attr('name', `gamestate[map][${areaId}][actions][new-${id}][link_id]`);
    $new.find('label [for=gamestate_map_area-new-action-new-link_id]')
        .attr('for', `gamestate_map_area-${areaId}-action-new-${id}-link_id`);

    $new.find('#gamestate_map_area-new-action-new-content')
        .attr('id', `gamestate_map_area-${areaId}-action-new-${id}-content`)
        .attr('name', `gamestate[map][${areaId}][actions][new-${id}][content]`);
    $new.find('label [for=gamestate_map_area-new-action-new-content]')
        .attr('for', `gamestate_map_area-${areaId}-action-new-${id}-content`);

    $new.find('#gamestate_map_area-new-action-new-duration')
        .attr('id', `gamestate_map_area-${areaId}-action-new-${id}-duration`)
        .attr('name', `gamestate[map][${areaId}][actions][new-${id}][duration]`);
    $new.find('label [for=gamestate_map_area-new-action-new-duration]')
        .attr('for', `gamestate_map_area-${areaId}-action-new-${id}-duration`);

    $new.find('#gamestate_map_area-new-action-new-to_state_id')
        .attr('id', `gamestate_map_area-${areaId}-action-new-${id}-to_state_id`)
        .attr('name', `gamestate[map][${areaId}][actions][new-${id}][to_state_id]`);
    $new.find('label [for=gamestate_map_area-new-action-new-to_state_id]')
        .attr('for', `gamestate_map_area-${areaId}-action-new-${id}-to_state_id`);

    $new.find('#gamestate_map_area-new-action-new-delay')
        .attr('id', `gamestate_map_area-${areaId}-action-new-${id}-delay`)
        .attr('name', `gamestate[map][${areaId}][actions][new-${id}][delay]`);
    $new.find('label [for=gamestate_map_area-new-action-new-delay]')
        .attr('for', `gamestate_map_area-${areaId}-action-new-${id}-delay`);

    $new.find('#gamestate_map_area-new-action-new-group_id')
        .attr('id', `gamestate_map_area-${areaId}-action-new-${id}-group_id`)
        .attr('name', `gamestate[map][${areaId}][actions][new-${id}][group_id]`);
    $new.find('label [for=gamestate_map_area-new-action-new-group_id]')
        .attr('for', `gamestate_map_area-${areaId}-action-new-${id}-group_id`);

    $new.find('#gamestate_map_area-new-action-new-image_id')
        .attr('id', `gamestate_map_area-${areaId}-action-new-${id}-image_id`)
        .attr('name', `gamestate[map][${areaId}][actions][new-${id}][image_id]`);
    $new.find('label [for=gamestate_map_area-new-action-new-image_id]')
        .attr('for', `gamestate_map_area-${areaId}-action-new-${id}-image_id`);

    $new.find('.remove-action-btn').confirmation({
        title: 'Delete this Action'
    }).on('click', removeAction);


    $new.find('.action-type-select').on('change', function(e){
        showAction($(this).closest('.action-row'));
    });

    $new.find('select').select2({
        theme:'bootstrap4',
        minimumResultsForSearch: 6,
        width:'resolve'
    });

    $new.appendTo($this.closest('.list-group-item'));
    $new.show();
    showAction($new);
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
