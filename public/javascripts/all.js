$(document).ready(function(){

  var winners_list_timer;

  $('.easy-select-box').easySelectBox();

  function showLoading(){
    $('body').append('<div class="loading"><img class="loading-animation" src="/img/loading.gif" /></div>');
  }

  function hideLoading(){
    $('.loading').remove();
  }

  function showMovie(){
    $('body').append('<div class="loading-dark"></div><img class="loading-movie" src="/img/movie.gif" />');
  }

  function hideMovie(){
    $('.loading-movie').effect('fade', {}, 2000, function(){
      $('.loading-dark').remove();
      $('.loading-movie').remove();
    });
  }

  $('#login_button').click(function(e){
    showLoading();
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
    showLoading();
    submitLottery('trial');
    return false;
  });
  $('#submit_button').click(function(e){
    showLoading();
    submitLottery('');
    return false;
  });

  function submitLottery(arg){
    var mode = arg;
    updateToken(function(elem){
      $('#message_area').html('');
      var form_data = new FormData();
      if(mode == 'trial'){
        form_data.append('mode', 'trial');
      }
      form_data.append('voice_text', $('#voice_text').val());
      form_data.append('phone_number', $('#phone_number').val());
      form_data.append('sms_phone_number', $('#sms_phone_number').val());
      form_data.append('_csrf', $('#csrf').val());
      if($('#voice_file').val()){
        var file_data = $('#voice_file').prop('files')[0];
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
            hideLoading();
            alert(e.message);
          }else{
            hideLoading();
            if(mode == 'trial'){
              //alert("success:" + e.message);
              $('#message_area').html('<p class="mes">仮設定が完了しました。こちらの番号に電話をかけてください。 '+e.message+'</p>');
              $('#submit_button').removeAttr('disabled');
              $('#submit_button').addClass('red');
            }else{
              location.href = e.url;
            }
          }
        },
        error: function(e){
          hideLoading();
          alert('エラーが発生しました');
        }
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

  var time_alert = true;

  function getWinners(){
    $.ajax({
      url: '/s/' + $('#token').html(),
      method: 'GET',
      error: function(e){console.log(e);},
      success: function(e){
        if(e.lottery){
          var createdAt = e.lottery.createdAt.toString().replace(/T/, ' ').replace(/\.[0-9]*Z/, '');
          var limit = Date.parseExact(createdAt, "yyyy-MM-dd HH:mm:ss").addHours(11).addMinutes(-15);
          var current_time = Date.today().setTimeToNow();
          if(time_alert && Date.compare(current_time, limit) > 0){
            alert("あと15分でデータが消去されます。抽選を行って下さい。");
            time_alert = false;
          }else{
            console.log(limit);
            console.log(current_time);
          }
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
          }else if(e.lottery.action_status == 'calling'){
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
                status = '呼び出し中';
                postfix = '';
                className = 'calling';
                break;
              case "error":
                status = 'エラー';
                className = 'end';
                postfix = '';
                break;
              case "won":
                if(e.data[i].callstatus){
                  status = '通話終了';
                  className = 'end';
                  postfix = '';
                  switch(e.data[i].callstatus){
                    case "completed":
                      postfix = '<li class="winner">通知済</li>';
                      finished += 1;
                    break;
                    case "busy":
                    case "error":
                    case "failed":
                    case "no-answer":
                      postfix = '<li class="response">応答なし</li>';
                      finished += 1;
                    break;
                    default:
                    break;
                  }
                }else{
                  status = '発信中';
                  postfix = '';
                  className = 'calling';
                }
                //if(e.data[i].callstatus == 'completed'){
                //  postfix = '<li class="winner">通知済</li>';
                //  finished += 1;
                //}else{
                //  postfix = '<li class="winner">当選</li>';
                //}
                break;
              default:
                status = '待機中';
                className = 'calling';
                postfix = '';
                break;
              }
            $('#table').append('<tr><th class="winners_number">'+e.data[i].phone_number.substr(-4)+'</th><td><ul><li class="'+className+'">'+status+ postfix + '</ul></td></tr>');
          } 
          $('#finished').html(finished);
        }
      }
    });
  }

  function showWinners(){
    function updateWinners(){
      var list = _.map($('.winners_number'), function(e){
        return '<li>' + $(e).html() + '</li>';
      });
      if(list){
        $('.prizewinnerNum').html(list);
        $('#winners_list').dialog("open");
      }
    }
    winners_list_timer = setInterval(updateWinners, 1000);
  }
  $('#winners_list').dialog({
    dialogClass: 'no-close',
    autoOpen: false,
    modal: true,
    minWidth: 900,
    minHeight: 600
  });
  $('#winners_list_close').click(function(){
    $('#winners_list').dialog("close");
    clearInterval(winners_list_timer);
  });

  $('#select_winners_button').click(function(){

    if($('#exclude').val()){
      $('#table').html("");
    }

    if(winners_list_timer){
      clearInterval(winners_list_timer);
    }
    showMovie();
    setTimeout(function(e){
      updateToken(function(){
        if($('#exclude').val()){
          startSelection();
        }else{
          clearAll(startSelection);
        }
      });
      hideMovie();
      showWinners();
    }, 5000);
    return false;
  });

  function clearAll(callback){
    $.ajax({
      url: '/call' + $('#token').html(),
      success: function(){callback();}
    });
  }

  function startSelection(){
    var data = $('#select_winners').serialize();
    $.ajax({
      url: '/select/',
      method: 'POST',
      data: data + "&token=" + $('#token').html(),
      success: function(e){
        //setTimeout(function(){
        //  hideMovie();
        //}, 3000);
        //alert(e.message);
      },
      error: function(){
        hideMovie();
      }
    });
    return false;
  }

  function goodbye(){
    if(window.location.href.match(/start$/)){
      window.location.href="/";
    }else{
      window.close();
    }
  }

  $('#halt').click(function(){
    $('#select_winners_button').attr('disabled', 'disabled');
    updateToken(function(){
      $.ajax({
        url: '/stop/' + $('#token').html() + '?_csrf=' + $('#csrf').val(),
        method: 'POST',
        data: "_csrf=" + $('#csrf').val(),
        success: function(e){
          $('#select_winners_button').removeAttr('disabled');
        },
        error: function(){
          $('#select_winners_button').removeAttr('disabled');
        }
      });
    });
  });

  $('#destroy').click(function(){
      if(confirm("抽選を終了しますか？この操作は取り消しできません")){
        if($('#token').length > 0){
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
      }else{
        goodbye();
      }
    }
  });
});
