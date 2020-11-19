$(function(){
    $('#code-feedback').hide();
    $('#code-form').on('submit', async function(e){
        e.preventDefault();
    });
    $('#code-entry').attr('disabled', true);
    $('.delete-btn').confirmation({
        title: 'Delete this item'
    }).on('click', deleteItem);
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
