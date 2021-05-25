/* global currentLocation xs md lg xl resizeImageMap */
$(function(){
    $('.select2').select2({
        theme:'bootstrap4',
        minimumResultsForSearch: 6,
        width:'resolve'
    });
    $('[data-toggle="tooltip"]').tooltip();
    $('#chat-hide').on('click', collapseChatSidebar);
    $('#chat-show').on('click', expandChatSidebar);
    $('#chat-show').hide();
    if (window.matchMedia('screen and (max-width:768px)').matches){
        $('#chat-sidebar').css({transition: '0s'});
        collapseChatSidebar();
        $('#chat-sidebar').css( {transition: '0.3s'});
    }
});

jQuery.fn.scrollTo = function($elem, speed) {
    var $this = jQuery(this);
    var container_top = $this.offset().top;
    var container_bottom = container_top + $this.height();
    var elem_top = $elem.offset().top;
    var elem_bottom = elem_top + $elem.height();

    if (elem_top > container_top && elem_bottom < container_bottom) {
        // in view so don't do anything
        console.log('already in view');
        return;
    }
    var new_scroll_top;
    if (elem_top < container_top) {
        new_scroll_top = {scrollTop: $this.scrollTop() - container_top + elem_top};
    } else {
        new_scroll_top = {scrollTop: elem_bottom - container_bottom + $this.scrollTop()};
    }
    console.log(new_scroll_top);
    $this.animate(new_scroll_top, speed === undefined ? 100 : speed);
    return this;
};


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

function collapseChatSidebar(e){
    if (e){
        e.preventDefault();
    }
    const $sidebar = $('#chat-sidebar');
    if (!$sidebar.length){
        return;
    }
    $sidebar.addClass('hidden');
    $('#chat-actions').hide();
    if (window.matchMedia('screen and (max-width:768px)').matches){
        $('#main-content').show();
    }
    setTimeout(function() {
        $('#chat-show').show();
        if ($('.imageHolder')){
            resizeImageMap();
        }
    }, 350);
}

function expandChatSidebar(e){
    if (e){
        e.preventDefault();
    }
    const $sidebar = $('#chat-sidebar');
    if (!$sidebar.length){
        return;
    }
    $('#chat-show').hide();
    $sidebar.removeClass('hidden');
    if (window.matchMedia('screen and (max-width:768px)').matches){
        $('#main-content').hide();
    }
    setTimeout(function() {
        resizeImageMap();
        $('#chat-actions').show();
        scrollSmoothToBottom($(`#chat-${currentLocation}-tab >> .chat-container`), true);
    }, 200);
}

function hideChatSidebar(){
    collapseChatSidebar();
    $('#chat-sidebar').addClass('notransition');
    $('#chat-sidebar').addClass('d-none');
    $('#chat-sidebar').removeClass('d-flex');
    $('#chat-sidebar').addClass('hide');
    setTimeout(function() {
        $('#chat-show').hide();
    }, 350);
}

function showChatSidebar(expand){
    $('#chat-sidebar').removeClass('hide');
    $('#chat-sidebar').removeClass('notransition');
    $('#chat-sidebar').removeClass('d-none');
    $('#chat-sidebar').addClass('d-flex');
    if (expand && !(xs || md)){
        expandChatSidebar();
    } else {
        collapseChatSidebar();
    }
}

function capitalize(string){
    return string.charAt(0).toUpperCase() + string.slice(1);
}

