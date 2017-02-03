
$(document).ready(function () {
    
    $.getJSON('/M3.json', function (json) {

        var th;
        var keys = Object.keys(json[0]);
        th = $('<tr/>');
        for (var key in json[0]) {
            th.append("<th>" + key + "</th>");
        }
        $('table').append(th);



    var tr;
    for (var i = 0; i < json.length; i++) {
        tr = $('<tr/>');
        for (var option in json[i]) {
            tr.append("<td>" + json[i][option] + "</td>");
        }
        $('table').append(tr);
    }

    });

});