$(function() {
    $('#start-jitsi-btn').confirmation({
        title: 'Start Jitsi Server?'
    }).on('click', startJitsiServer);

    $('#stop-jitsi-btn').confirmation({
        title: 'Stop Jitsi Server?'
    }).on('click', stopJitsiServer);
});

async function startJitsiServer(e){
    e.preventDefault();
    const $this = $(this);
    const url = '/meeting/jitsi/start';
    const csrf = $this.attr('data-csrf');
    const result = await fetch(url, {
        method:'PUT',
        headers: {
            'csrf-token': csrf
        }
    });
    location.reload();
}

async function stopJitsiServer(e){
    e.preventDefault();
    const $this = $(this);
    const url = '/meeting/jitsi/stop';
    const csrf = $this.attr('data-csrf');
    const result = await fetch(url, {
        method:'PUT',
        headers: {
            'csrf-token': csrf
        }
    });
    location.reload();
}
