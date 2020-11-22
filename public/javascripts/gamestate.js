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
    });
    showMapGroup();
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
