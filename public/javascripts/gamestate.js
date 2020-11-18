$(function(){
    $('#code-feedback').hide();
    $('#code-form').on('submit', async function(e){
        e.preventDefault();
    });
    $('#code-entry').attr('disabled', true);
});
