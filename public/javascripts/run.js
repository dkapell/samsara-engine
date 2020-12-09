$(function(){
    $('#reset-run-btn').confirmation({
        title: 'Reset this Run?'
    }).on('click', runAction);

    $('#state-update-btn').confirmation({
        title: 'Update multiple Players?'
    }).on('click', updateAll);

    $('.next-step-all-btn').confirmation({
        title: 'Advance all Players?'
    }).on('click', runAction);

});

async function runAction(e){
    e.preventDefault();
    const $this = $(this);
    const url = $this.attr('url');
    const csrf = $this.attr('data-csrf');
    const result = await fetch(url, {
        method:'PUT',
        headers: {
            'csrf-token': csrf
        }
    });
    if($this.attr('data-back')){
        location = $this.attr('data-back');
    } else {
        location.reload();
    }
}

async function updateAll(e){
    e.preventDefault();
    const $this = $(this);
    const url = $this.attr('url');
    const csrf = $this.attr('data-csrf');
    const formData = new FormData();
    const state_id = $('#run-update-state').val();
    const group_id = $('#run-update-state-group').val();
    if (!state_id || state_id === ''){
        return;
    }
    const result = await fetch(url, {
        method:'PUT',
        headers: {
            'csrf-token': csrf,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            state_id: state_id,
            group_id: group_id
        })
    });
    if($this.attr('data-back')){
        location = $this.attr('data-back');
    } else {
        location.reload();
    }
}
