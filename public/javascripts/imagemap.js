/* global _ areaTimers:writable resizeImageMap */
let link_idLocked = false;

$(function(){
    //For Show
    prepImageMapGM();
    $('area').on('mouseover', showLink);
    $('area').on('mouseout', clearLink);
    $('area').on('click', toggleLock);
});

function prepImageMapGM(){
    let inArea = false;
    const allOpts = {
        strokeColor: 'ffffff',
        strokeOpacity: 0.5,
        fillColor: 'ffffff',
        fillOpacity: 0.2,
        stroke:true,
        strokeWidth:1,
        showToolTip: false,
    };
    const singleOpts ={
        strokeColor: 'ffffff',
        strokeOpacity: 0.5,
        fillColor: 'e74c3c',
        fillOpacity: 0.3,
        stroke:true,
        strokeWidth:1,
        showToolTip: true,
        toolTipClose: ['area-mouseout', 'area-click'],
        toolTipContainer:  $('<div>')
            .addClass('border')
            .addClass('border-light')
            .addClass('rounded')
            .addClass('bg-dark')
            .addClass('text-light')
            .addClass('p-2')
            .addClass('mb-1')
            .addClass('shadow-sm'),
        areas: []
    };
    const initialOpts = {
        toolTipClose: ['area-mouseout', 'area-click'],
        mapKey: 'data-groups',
        onMouseover: function (data) {
            inArea = true;
        },
        onMouseout: function (data) {
            inArea = false;
        }
    };
    const opts = $.extend({}, allOpts, initialOpts, singleOpts);
    const $screenImage = $('#screen-image');
    $screenImage
        .mapster('unbind')
        .mapster(opts)
        .bind('mouseover', function () {
            if (!inArea) {
                $screenImage.mapster('set_options', allOpts)
                    .mapster('set', true, 'all')
                    .mapster('set_options', singleOpts);
            }
        }).bind('mouseout', function () {
            if (!inArea) {
                $screenImage.mapster('set', false, 'all');
            }
        });

    resizeImageMap();
}

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


