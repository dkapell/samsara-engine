$(function(){
    $('.reset-run-btn').confirmation({
        title: 'Reset this Run?'
    }).on('click', resetRun);

    $('#state-update-btn').confirmation({
        title: 'Update all Players?'
    }).on('click', updateAll);
});

async function resetRun(e){
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
    const state_id = $('#run-update-state').val()
    if (!state_id || state_id === ''){
        return;
    }
    const result = await fetch(url, {
        method:'PUT',
        headers: {
            'csrf-token': csrf,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({state_id: state_id})
    });
    if($this.attr('data-back')){
        location = $this.attr('data-back');
    } else {
        location.reload();
    }
}
