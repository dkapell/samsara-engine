$(function(){
    $('#user_type').on('change', updateUser);
    updateUser();
});

function updateUser(e){
    if ( $('#user_type').val() === 'player'){
        $('#player_fields').show();
    } else {
        $('#player_fields').hide();
    }
}
