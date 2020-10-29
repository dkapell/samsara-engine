$(function(){
    $('#code-feedback').hide();
    $('#code-form').on('submit', async function(e){
        e.preventDefault();
        $('#code-feedback').hide();
        const code = $('#code-entry').val();
        const response = await fetch('/code/'+ code);
        const data = await response.json();
        if (!data.success){
            $('#code-entry').addClass('is-invalid');
            if (!data.retry){
                console.log('clear');
                $('#code-entry').val('');
            }
            $('#code-feedback').text(data.error);
            $('#code-feedback').show();

        } else {
            window.open(data.url, '_blank');
            $('#code-entry').removeClass('is-invalid');
            $('#code-entry').val('');
        }
    });

    $('#code-entry').on('change keyup copy paste cut', function() {
        if (!this.value) {
            $(this).removeClass('is-invalid');
        }
    });
});
