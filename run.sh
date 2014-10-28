#!/bin/sh

export NODE_ENV=development
export PORT=3000
export CUSTOMCONNSTR_MONGOLAB_URI=localhost:27017
export SESSION_SECRET=asdajladsa9879adslkjLad097aadjhfgadsadsaihdljk79IhljHKL7akdlf

supervisor app
