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
    updateToken(function(e){
      var form_data = new FormData();
      var file_data = $('#voice_file').prop('files')[0];
      form_data.append('mode', 'trial');
      form_data.append('voice_text', $('#voice_text').val());
      form_data.append('phone_number', $('#phone_number').val());
      if($('#voice_file').val()){
        form_data.append('voice_file', file_data);
      }
      $.ajax({
        url: '/number',
        enctype: 'multipart/form-data',
        processData: false,
        method: 'POST',
        data: form_data,
        success: function(e){alert("success:" + e.message);},
        error: function(e){alert('エラーが発生しました');}
      });
    });
    return false;
  });

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

  $('#select_winners_button').click(function(){
    var data = $('#select_winners').serialize();
    $.ajax({
      url: '/l/' + $('#token').html() + "?csrf=" + $('#csrf').val(),
      method: 'POST',
      data: data,
      success: function(e){
        if(e.success === false){
          alert(e.message);
        }
      }
    });
    return false;
  });

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
