$(document).ready(function(){
  function updateToken(callback){
    $.ajax({
      url: '/token',
      method: 'GET',
      success: function(e){
        $('#csrf').val(e.csrf);
        callback();
      }
    });
  }
  $('#tmp_button').click(function(e){
    submitLotter('trial');
    return false;
  });
  $('#submit_button').click(function(e){
    submitLottery('');
    return false;
  });

  function submitLottery(arg){
    var mode = arg;
    updateToken(function(elem){
      var form_data = new FormData();
      var file_data = $('#voice_file').prop('files')[0];
      if(mode == 'trial'){
        form_data.append('mode', 'trial');
      }
      form_data.append('voice_text', $('#voice_text').val());
      form_data.append('phone_number', $('#phone_number').val());
      form_data.append('_csrf', $('#csrf').val());
      if($('#voice_file').val()){
        form_data.append('voice_file', file_data);
      }
      $.ajax({
        url: '/number?_csrf=' + $('#csrf').val(),
        enctype: 'multipart/form-data',
        processData: false,
        contentType: false,
        method: 'POST',
        data: form_data,
        success: function(e){
          if(mode == 'trial'){
            alert("success:" + e.message);
            $('#debug').html(e.debug);
          }else{
            location.href = "/l/" + $('#token').html();
          }
        },
        error: function(e){alert('エラーが発生しました');}
      });
    });
  }

  if($('#candidates').length > 0){
    setInterval(function(e){
      $.ajax({
        url: '/candidates?id=' + $('#token').html(),
        method: 'GET',
        success: function(e){
          $('#candidates').html(e.num);
        }
      });
      $.ajax({
        url: '/winners?id=' + $('#token').html(),
        method: 'GET',
        success: function(e){
          $('#winners').html(e.num);
        }
      });
    }, 3000);
  }

  var winner_timer;

  $('#select_winners_button').click(function(){
    updateToken(startSelection());
    return false;
  });

  function startSelection(){
    var data = $('#select_winners').serialize();
    $.ajax({
      url: '/l/',
      method: 'POST',
      data: data + "&token=" + $('#token').html(),
      success: function(e){
        if(e.success === false){
          alert(e.message);
        }else{
          winner_timer = setInterval(function(){
            $.ajax({
              url: '/s/' + $('#token').html(),
              success: function(e){
               $('#table').html("");
               for(var i = 0, l = e.data.length; i < l; i++){
                var status;
                switch(e.data[i].status){
                  case "calling":
                    status = '発信中';
                    break;
                  case "online":
                    status = '通話中';
                    break;
                  case "error":
                    status = 'エラー';
                    break;
                  case "won":
                    status = '通話終了';
                    break;
                  default:
                    status = '待機中';
                    break;
                }
                $('#table').append('<tr><td>'+e.data[i].phone_number.substr(-4)+'</td><td>'+status+'</td></tr>');
               } 
              }
            });
          });
        }
      }
    });
    return false;
  }

  $('#destroy').click(function(){
    if(confirm("抽選を終了しますか？この操作は取り消しできません")){
      console.log('destroy');  
      $.ajax({
        url: '/destroy/' + $('#token').html() + '?_csrf=' + $('#csrf').val(),
        method: 'POST',
        success: function(e){
          window.location.href="/";
        }
      });
    }
  });

});
