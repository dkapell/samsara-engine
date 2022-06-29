$(function(){
    // For Form
    $('#function_type').on('change', updateFunctionType);
    updateFunctionType();
});

function updateFunctionType(e){
    const val = $('#function_type').val();
    if (val === 'ink'){
        $('.ink-function-details').show();
    } else {
        $('.ink-function-details').hide();
    }
}
