let codeLocked = false;
let nextIndex = 0;
$(function(){
    // For Show
    $('img[usemap]').rwdImageMaps();
    $('area').on('click', toggleLock);
    $('area').on('mouseover', showCode);
    $('area').on('mouseout', clearCode);

    // For Form
    $('.remove-area-btn').on('click', removeArea);
    $('#add-area-btn').on('click', addArea);
    $('#new-area').hide();

});

function showCode(e){
    $('#code-display').val($(this).attr('data-code'));
}

function clearCode(e){
    if(!codeLocked){
        $('#code-display').val('');
    }
}

function toggleLock(e){
    e.preventDefault();
    e.stopPropogation();
    codeLocked = !codeLocked;
}

function removeArea(e){
    const $this = $(this);
    e.preventDefault();
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
    $new.appendTo('#imagemap_map');
    $new.show();
}
