$(function(){
    $('#reset-run-btn').confirmation({
        title: 'Reset this Run?'
    }).on('click', runAction);

    $('#reset-ink-all-btn').confirmation({
        title: 'Reset all Ink stories for this Run?'
    }).on('click', runAction);


    $('#screen-update-btn').confirmation({
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
    }
}

async function updateAll(e){
    e.preventDefault();
    const $this = $(this);
    const url = $this.attr('url');
    const csrf = $this.attr('data-csrf');
    const formData = new FormData();
    const screen_id = $('#run-update-screen').val();
    const group_id = $('#run-update-screen-group').val();
    if (!screen_id || screen_id === ''){
        return;
    }
    const result = await fetch(url, {
        method:'PUT',
        headers: {
            'csrf-token': csrf,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            screen_id: screen_id,
            group_id: group_id
        })
    });
    if($this.attr('data-back')){
        location = $this.attr('data-back');
    }
}
