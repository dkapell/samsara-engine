$(function(){
    $('#code-form').on('submit', async function(e){
        e.preventDefault();
        const code = $('#code-entry').val();
        const response = await fetch('/code/'+ code);
        const data = await response.json();
        if (!data.success){
            $('#code-entry').addClass('is-invalid');
            $('#code-feedback').text(data.error);
        } else {
            window.open(data.url, '_blank');
            $('#code-entry').removeClass('is-invalid');
            const code = $('#code-entry').val('');
        }
    });

    $('#code-entry').on('change keyup copy paste cut', function() {
        if (!this.value) {
            $(this).removeClass('is-invalid');
        }
    });
});
