$(document).ready(function(){

  $('#login_button').click(function(e){
    $('#login_form').submit();
  });

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
    submitLottery('trial');
    return false;
  });
  $('#submit_button').click(function(e){
    submitLottery('');
    return false;
  });

  function submitLottery(arg){
    var mode = arg;
    updateToken(function(elem){
      $('#message_area').html('');
      var form_data = new FormData();
      var file_data = $('#voice_file').prop('files')[0];
      if(mode == 'trial'){
        form_data.append('mode', 'trial');
      }
      form_data.append('voice_text', $('#voice_text').val());
      form_data.append('phone_number', $('#phone_number').val());
      form_data.append('sms_phone_number', $('#sms_phone_number').val());
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
          if(e.error){
            alert(e.message);
          }else{
            if(mode == 'trial'){
              //alert("success:" + e.message);
              $('#message_area').html('<p class="mes">仮設定しました。'+e.message+'</p>');
              $('#submit_button').removeAttr('disabled');
            }else{
              location.href = e.url;
            }
          }
        },
        error: function(e){alert('エラーが発生しました');}
      });
    });
  }

  if($('#candidates').length > 0){
    setInterval(function(e){
      getWinners();
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

  function getWinners(){
    $.ajax({
      url: '/s/' + $('#token').html(),
      method: 'GET',
      error: function(e){console.log(e);},
      success: function(e){
        if(e.lottery){
          switch(e.action_status){
            case "calling":
              break;
            default:
              break;
          }
        }
        if(e.lottery){
          if(e.lottery.call_session > 0){
            $('#call_status').html('<span class="calling">呼び出し中</span>');
          }else if(e.lottery.satus == 'calling'){
            $('#call_status').html('<span class="end">終了</span>');
          }
        }
        if(e.data){
          $('#table').html("");
          var finished = 0;
          for(var i = 0, l = e.data.length; i < l; i++){
            var status, postfix, className;
            switch(e.data[i].status){
              case "calling":
                status = '発信中';
                postfix = '';
                className = 'calling';
                break;
              case "online":
                status = '通話中';
                postfix = '';
                className = 'calling';
                break;
              case "error":
                status = 'エラー';
                className = 'end';
                postfix = '';
                break;
              case "won":
                status = '通話終了';
                className = 'end';
                if(e.data[i].callstatus == 'completed'){
                  postfix = '<li class="winner">通知済</li>';
                  finished += 1;
                }else{
                  postfix = '<li class="winner">当選</li>';
                }
                break;
              default:
                status = '待機中';
                className = 'calling';
                postfix = '';
                break;
              }
            $('#table').append('<tr><th>'+e.data[i].phone_number.substr(-4)+'</th><td><ul><li class="'+className+'">'+status+ postfix + '</ul></td></tr>');
          } 
          $('#finished').html(finished);
        }
      }
    });
  }

  $('#select_winners_button').click(function(){
    updateToken(startSelection);
    return false;
  });

  function startSelection(){
    var data = $('#select_winners').serialize();
    $.ajax({
      url: '/select/',
      method: 'POST',
      data: data + "&token=" + $('#token').html(),
      success: function(e){
        if(e.success === false){
          alert(e.message);
        }
      }
    });
    return false;
  }

  function goodbye(){
    window.location.href="/";
  }

  $('#destroy').click(function(){
    if($('#token').length > 0){
      if(confirm("抽選を終了しますか？この操作は取り消しできません")){
        console.log('destroy');  
        updateToken(function(){
          $.ajax({
            url: '/destroy/' + $('#token').html() + '?_csrf=' + $('#csrf').val(),
            method: 'POST',
            success: function(e){
              goodbye();
            }
          });
        });
      }
    }else{
      goodbye();
    }
  });
});
