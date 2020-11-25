$(function(){
    $('#code-feedback').hide();
    $('#code-form').on('submit', async function(e){
        e.preventDefault();
    });
    $('#code-entry').attr('disabled', true);
    $('.delete-btn').confirmation({
        title: 'Delete this item'
    }).on('click', deleteItem);

    $('#gamestate_image_id').on('change', function(e){
        showMapGroup();
        showImage();
    });
    showMapGroup();

    $('.area-detail-card').hide();
    $('.map-highlight').on('mouseover', showMapArea);
    $('.map-highlight').on('mouseout', hideMapArea);
});

async function deleteItem(e){
    e.preventDefault();
    const $this = $(this);
    const url = $this.attr('url');
    const result = await fetch(url, {method:'DELETE'});
    if($this.attr('data-back')){
        location = $this.attr('data-back');
    }
}

function showMapGroup(e){
    const image = $('#gamestate_image_id').val();
    if(image !== '-1'){
        $('#map-group').show();
    } else {
        $('#map-group').hide();
    }
}


function showMapArea(e){
    const $this = $(this);
    const areaId = $this.attr('data-area');
    $(`#area-${areaId}`).mouseover();
}

function hideMapArea(e){
    const $this = $(this);
    const areaId = $this.attr('data-area');
    $(`#area-${areaId}`).mouseout();
}

function showImage(){
    const image = $('#gamestate_image_id').val();
    const url = $('#gamestate_image_id').find(':selected').attr('data-url');
    if (image === '-1'){
        $('#gamestate-image').attr('src','');
    } else {
        $('#gamestate-image').attr('src',url );
    }
}
