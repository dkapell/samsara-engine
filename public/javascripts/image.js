/* global bsCustomFileInput */
$(document).ready(function () {
    bsCustomFileInput.init();
    $('#imagePicker').on('change', updateImage);
    $('#new-image-form').on('submit', submitImageForm);
});

function updateImage(e){
    const file = ($(this).prop('files'))[0];
    $('#upload-feedback').text('');
    if (file){
        $('#upload-type').html('<strong>Type</strong>: ' + file.type);
        $('#upload-size').html('<strong>Size</strong>: ' + prettyPrintSize(file.size));
    } else {
        $('#upload-type').text('');
        $('#upload-size').text('');
    }
}

async function submitImageForm(e){
    e.preventDefault();
    var $this = $(this);
    const file = ($('#imagePicker').prop('files'))[0];
    if (!file){
        return false;
    }
    const uploaded = await getSignedRequest(file);
    if (uploaded){
        $this.unbind('submit').submit();
        return true;
    } else {
        return false;
    }
}

async function getSignedRequest(file){
    try{
        const result = await fetch(`/image/sign-s3?filename=${file.name}&filetype=${file.type}`, {credentials: 'include'});
        const response = await result.json();
        if (!response.success){
            $('#upload-feedback').text(response.error);
            return false;
        }
        const imageId = response.data.imageId;
        $('#image-id').val(imageId);
        $('#new-image-form').attr('action', '/image/' + imageId);
        return await uploadFile(file, response.data.signedRequest, response.data.url);

    } catch (err){
        $('#upload-feedback').text('Error getting signed request');
        console.trace(err);
        return false;
    }
}

async function uploadFile(file, signedRequest, url){
    try {
        await fetch(signedRequest, {method:'PUT', body: file});
        $('#image-status').val('ready');
        return true;
    } catch (err){
        $('#upload-feedback').text('Error uploading file');
        console.trace(err);
        return false;
    }
}

function prettyPrintSize(value, type) {
    if (!value) {
        return '0';
    }
    if (!type){
        type = 'B';
    }
    var prefixes = [ '', 'K', 'M', 'G', 'T', 'P', 'E' ];
    var index;
    for (index = 0; value >= 1024 && index < prefixes.length - 1; index++)
        value /= 1024;

    if (value > 1024 || Math.round(value) === value)
        value = Math.round(value).toString();
    else if (value < 10)
        value = value.toFixed(2);
    else
        value = value.toPrecision(4);

    value += ' ' + prefixes[index];

    if (index !== 0)
        value += type;

    return value;
}
