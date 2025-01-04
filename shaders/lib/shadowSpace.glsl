#ifndef SHADOW_SPACE_GLSL
#define SHADOW_SPACE_GLSL

vec3 getShadowScreenPos(vec3 feetPlayerPos, out int cascade){
  vec4 shadowViewPos = (shadowModelView * vec4(feetPlayerPos, 1.0));
  vec4 shadowClipPos;
  
  for(cascade = 0; cascade < 4; cascade++){
    shadowClipPos = shadowProjection[cascade] * shadowViewPos;

    if(clamp(shadowClipPos.xy, vec2(-1.0), vec2(1.0)) == shadowClipPos.xy) break;
  }

  float bias = 0.004;

  shadowClipPos.z -= bias;
  return shadowClipPos.xyz * 0.5 + 0.5;
}

#endif // SHADOW_SPACE_GLSL