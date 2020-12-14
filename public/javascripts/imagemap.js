/* global _ */
let link_idLocked = false;
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

