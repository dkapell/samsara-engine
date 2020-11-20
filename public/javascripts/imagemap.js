let codeLocked = false;
let nextIndex = 0;
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
    $('area').on('mouseover', showRoom);
    $('area').on('mouseout', clearRoom);

    // For Form
    $('.remove-area-btn').on('click', removeArea);
    $('#add-area-btn').on('click', addArea);
    $('#new-area').hide();

    $('.delete-btn').confirmation({
        title: 'Delete this item'
    }).on('click', deleteItem);

});

function showRoom(e){
    $('#room-name').text($(this).attr('data-room'));
}

function clearRoom(e){
    if(!codeLocked){
        $('#room-name').html('&nbsp;');
    }
}

function toggleLock(e){
    e.preventDefault();
    e.stopPropagation();
    codeLocked = !codeLocked;
}

function removeArea(e){
    const $this = $(this);
    e.preventDefaulstopPropagationt();
    $this.closest('.list-group-item').remove();
}

function addArea(e){
    const $this = $(this);
    e.preventDefault();

    const $new = $('#new-area').clone();
    const id = nextIndex++;

    $new.find('#imagemap_map_area_code-new')
        .attr('required', true)
        .attr('id', 'imagemap_map_area_code-new-' + id)
        .attr('name', `imagemap[map][new-${id}][code]`);
    $new.find('label [for=imagemap_map_area_code-new]')
        .attr('for', 'imagemap_map_area_code-new-' + id);

    $new.find('#imagemap_map_area_coords-new')
        .attr('required', true)
        .attr('id', 'imagemap_map_area_coords-new-' + id)
        .attr('name', `imagemap[map][new-${id}][coords]`);
    $new.find('label [for=imagemap_map_area_coords-new]')
        .attr('for', 'imagemap_map_area_code-new-' + id);


    $new.find('#imagemap_map_area_shape-new')
        .attr('required', true)
        .attr('id', 'imagemap_map_area_shape-new-' + id)
        .attr('name', `imagemap[map][new-${id}][shape]`);
    $new.find('label [for=imagemap_map_area_shape-new]')
        .attr('for', 'imagemap_map_area_code-new-' + id);

    $new.find('.remove-area-btn').on('click', removeArea);

    $new.find('select').select2({
        theme:'bootstrap4',
    });
    $new.appendTo('#imagemap_map');
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
