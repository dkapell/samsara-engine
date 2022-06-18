$(function(){

    $('#clone_fakeUsers').on('change', updateCloneTables);
    $('.clonetable-player').on('change', updateFakeUsers);
});

function updateCloneTables(e){
    const $this = $(this);
    if ($this.is(':checked')){
        $('.clonetable-player').prop('checked', false);
    }
}

function updateFakeUsers(e){
    const $this = $(this);
    if ($this.is(':checked')){
        $('#clone_fakeUsers').prop('checked', false);
    }
}
