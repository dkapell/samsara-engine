/* global _ resizeImageMap prepImageMap gamedata resizable ws  sendCloseInkStory sendInkChoice */
/* global halfContent fullContent closeContent */

let inkShowing = false;
const inkShowQueue = [];

$(function(){
    $('#content-adjust >> .resizer-expand').on('click', function(e){
        e.stopPropagation();
        fullContent();
    });
    $('#content-adjust >> .resizer-restore').on('click', function(e){
        e.stopPropagation();
        halfContent();
    });
    $('#content-adjust >> .resizer-close').on('click', function(e){
        e.stopPropagation();
        closeInk();
    });
});

async function handleInk(data){
    switch (data.type){
        case 'open': openInk(data.fullscreen); break;
        case 'text': addInkText(data.text); break;
        case 'choices': addInkChoices(data.choices); break;
        case 'end': doneInk(); break;
        case 'close': closeInk(); break;
    }
}

function openInk(fullscreen){
    inkShowing = true;
    if (fullscreen || $('#game-content').height() < 600 || $('#game-content').width() < 768){
        fullContent(true, true);
    } else {
        halfContent(false, true);
    }
    showNextInk();
}

function addInkText(text){
    const $p = $('<p>');
    $p.text(text)
        .addClass('ink-text');

    addInkElement($p);
}

function addInkElement($elem){
    $elem.addClass('collapse');

    $('#ink-story').append($elem);
    if (!inkShowing){
        inkShowing = true;
        $elem.on('shown.bs.collapse', function() {
            scrollSmoothToBottom($('#ink-container'));
            showNextInk();
        });

        $elem.collapse('show');
    } else {
        inkShowQueue.push($elem);
    }
}

function showNextInk(){
    if (!inkShowQueue.length){
        inkShowing = false;
    } else {
        const $elem = inkShowQueue.shift();
        $elem.on('shown.bs.collapse', function() {
            scrollSmoothToBottom($('#ink-container'));
            showNextInk();
        });
        $elem.collapse('show');
    }
}

function addInkChoices(choices){
    const $choicesUl = $('<ul>')
        .addClass('list-unstyled')
        .addClass('ink-choices');

    for (const choice of choices){
        const $li = $('<li>');
        const $a = $('<a>')
            .addClass('ink-choice')
            .text(choice.text)
            .on('click', function(e){
                e.preventDefault();
                sendInkChoice(choice.idx);
                $('.ink-choices').hide();
            })
            .appendTo($li);
        $choicesUl.append($li);
    }

    addInkElement($choicesUl);
}

function doneInk(){
    const $btn = $('<button>')
        .addClass('btn')
        .addClass('btn-outline-success')
        .addClass('btn-block')
        .addClass('my-3')
        .text('Close')
        .on('click', function(e){
            e.preventDefault();
            closeInk();
        });

    addInkElement($btn);
}

function closeInk(){
    closeContent();
    $('#ink-story').empty();
    sendCloseInkStory();
}

function scrollSmoothToBottom ($elem, fast) {
    var div = $elem[0];
    $elem.data('autoscroll', true);

    if (fast){
        $elem.scrollTop(function() { return this.scrollHeight; });
        $elem.data('autoscroll', false);
    } else {
        $elem.animate({
            scrollTop: div.scrollHeight - div.clientHeight
        }, 100, ()=>{
            setTimeout(()=>{
                $elem.data('autoscroll', false);
            }, 50);
        });
    }
}

