/* global _ resizeImageMap prepImageMap gamedata resizable ws  sendCloseInkStory sendInkChoice */
/* global halfContent fullContent closeContent */

let inkActive = false;
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
        case 'data': displayInk(data.data); break;
        case 'text': addInkText(data.text, data.options); break;
        case 'choices': addInkChoices(data.choices); break;
        case 'end': doneInk(); break;
        case 'close': closeInk(); break;
    }
}

function openInk(fullscreen){
    if (inkActive){
        return;
    }
    inkActive = true;
    inkShowing = true;
    if (fullscreen || $('#game-content').height() < 600 || $('#game-content').width() < 768){
        fullContent(true, true);
    } else {
        halfContent(false, true);
    }
    showNextInk();
}

function displayInk(data){
    for (const datum of data){
        switch (datum.type){
            case 'text': addInkText(datum.text, datum.options); break;
            case 'choices': addInkChoices(datum.choices); break;
            case 'end': doneInk(); break;
        }
    }
}

function addInkText(text, options){
    const $p = $('<p>');
    $p.text(text)
        .addClass('ink-text');
    if (_.has(options, 'class') && options.class){
        $p.addClass(options.class);
    }
    if (_.has(options, 'color') && options.color){
        $p.css('color', options.color);
    }
    if (_.has(options, 'bgcolor') && options.bgcolor){
        $p.css('background-color', options.bgcolor);
    }

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
    inkActive = false;
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

