#version 450 core

#include "/lib/common.glsl"

in vec2 uv;


layout(location = 0) out vec3 previousScene;
layout(location = 1) out vec2 previousDepth;

void main(){
  previousScene = texture(sceneTex, uv).rgb;
  previousDepth.r = texture(mainDepthTex, uv).r;
  previousDepth.g = texture(solidDepthTex, uv).r;

}