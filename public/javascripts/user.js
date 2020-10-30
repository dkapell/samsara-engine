$(function(){
    $('#user_is_player').on('change', updateUser);
    updateUser();
});

function updateUser(e){
    console.log('here');
    if ( $('#user_is_player').prop('checked')){
        $('#player_fields').show();
    } else {
        $('#player_fields').hide();
    }
}
