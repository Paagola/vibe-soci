#!/usr/bin/env bash
# Tercer montaje (v3b): tres bandas 1080x640 en capas (fondo / rotulo / copa+mano), rotulo medido sobre el reel de referencia.
# Uso: node capas.mjs && ./montar.sh   (desde esta carpeta; deja ../cocteles-v3.mp4). Cortes del original: 5,03 y 6,57 s; aqui 4,6 y 6,8 s (el arrastre termina ~4,3 s).
set -euo pipefail
cd "$(dirname "$0")"; V=../brutos/v3; T=tmp; mkdir -p $T
FIT="fps=25,scale=-2:640,crop=1080:640:(iw-1080)/2:0,setsar=1"
MATE="blend=all_mode=difference,format=gray,lut=y='if(gt(val,26),255,0)',boxblur=7:2,lut=y='if(gt(val,30),255,0)',boxblur=3:1"
banda(){ # id arrastre detalle
  local id=$1 a=$V/$2 d=$V/$3
  ffmpeg -v error -y -sseof -0.05 -i $a -frames:v 1 -vf "$FIT" $T/$id-plate.png
  # apertura: rotulo revelado por la estela de la copa, detras de copa y mano
  ffmpeg -v error -y -i $a -framerate 25 -i $T/$id-tx/%03d.png -loop 1 -framerate 25 -t 5.2 -i $T/$id-plate.png -filter_complex "
    [0:v]$FIT,format=rgb24,split=3[b][m0][f0]; [2:v]format=rgb24[pl];
    [m0][pl]$MATE[mk]; [f0][mk]alphamerge[fg];
    [1:v]format=rgba[tx]; [b][tx]overlay[x];[x][fg]overlay,format=yuv420p" -t 5.2 -c:v libx264 -crf 14 -preset fast $T/$id-apertura.mp4
  # cierre: rotulo fijo detras de la copa (que vuelve), con fundido de salida al final (fundido de entrada antes de invertir)
  ffmpeg -v error -y -i $a -loop 1 -framerate 25 -t 5.2 -i rotulo-$id.png -loop 1 -framerate 25 -t 5.2 -i $T/$id-plate.png -filter_complex "
    [0:v]$FIT,format=rgb24,split=3[b][m0][f0]; [2:v]format=rgb24[pl];
    [m0][pl]$MATE[mk]; [f0][mk]alphamerge[fg];
    [1:v]format=rgba,fade=in:st=0:d=0.6:alpha=1[tx]; [b][tx]overlay[x];[x][fg]overlay,format=yuv420p" -t 5.2 -c:v libx264 -crf 14 -preset fast $T/$id-cierre.mp4
  ffmpeg -v error -y -i $T/$id-cierre.mp4 -vf reverse -an $T/$id-cierre-rev.mp4
  # detalle: el mismo rotulo, en el mismo sitio, sobre el macro
  ffmpeg -v error -y -i $d -loop 1 -framerate 25 -t 3 -i rotulo-$id.png -filter_complex "[0:v]$FIT,format=rgba[v];[v][1:v]overlay,format=yuv420p" -t 3 -c:v libx264 -crf 14 $T/$id-detalle.mp4
  ffmpeg -v error -y -i $T/$id-apertura.mp4 -i $T/$id-detalle.mp4 -i $T/$id-cierre-rev.mp4 -filter_complex "
    [0:v]trim=0:4.6,setpts=PTS-STARTPTS[a];[1:v]trim=0:2.2,setpts=PTS-STARTPTS[b];[2:v]trim=0:5.2,setpts=PTS-STARTPTS[c];
    [a][b][c]concat=n=3:v=1:a=0" -r 25 -c:v libx264 -crf 14 -pix_fmt yuv420p $T/$id-banda.mp4
}
banda clover-club clover-arrastre.mp4 clover-detalle.mp4
banda old-fashioned old-arrastre.mp4 old-detalle.mp4
banda espresso-martini espresso-arrastre.mp4 espresso-detalle.mp4
ffmpeg -v error -y -i $T/clover-club-banda.mp4 -i $T/old-fashioned-banda.mp4 -i $T/espresso-martini-banda.mp4 -i ../sonido.wav -loop 1 -framerate 25 -t 12 -i pregunta.png -filter_complex "
  [0:v][1:v][2:v]vstack=3,format=rgba[s];[4:v]format=rgba,fade=in:st=8.2:d=0.6:alpha=1[q];
  [s][q]overlay=0:0:format=auto,format=yuv420p[v]" -map "[v]" -map 3:a -t 12 -c:v libx264 -crf 17 -preset medium -c:a aac -b:a 192k -shortest ../cocteles-v3.mp4
echo ok
