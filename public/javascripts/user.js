/* global _ */
$(function(){
    $('#user_type').on('change', updateUser);
    $('#user_character_template').on('change', updateCharacter);
    updateUser();
});

function updateUser(e){
    if ( $('#user_type').val() === 'player'){
        $('#player_fields').show();
    } else {
        $('#player_fields').hide();
    }
}

function updateCharacter(e){
    const option = $('#user_character_template').find(':selected');
    if (option.val() !== -1){
        $('#user_character').val(option.data('character').name);
        $('#user_character_sheet').val(option.data('character').character_sheet);
        $('#user_data').val(JSON.stringify(option.data('character').data, null, 2));
        $('#user_data').data('editor').setValue(JSON.stringify(option.data('character').data, null, 2));
        $('#user_groups').val(_.pluck(option.data('character').groups, 'id')).trigger('change');
    }
}
