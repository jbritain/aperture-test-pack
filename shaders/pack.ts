function defineBoolGlobally(define){
    if(getBoolSetting(define)){
        defineGlobally(define, 1);
    }
}

function setupShader() {    
    defineBoolGlobally("BLOOM_ENABLE");
    defineGlobally("SHADOW_SAMPLES", getIntSetting("SHADOW_SAMPLES"));
    defineBoolGlobally("DEBUG_ENABLE");


    worldSettings.ambientOcclusionLevel = 1.0;
    worldSettings.disableShade = true;
    worldSettings.renderEntityShadow = false;
    worldSettings.shadowMapResolution = 1024;
    worldSettings.sunPathRotation = -40.0;

    const sceneData = new Buffer(32)
        .clear(true)
        .build();

    const blueNoiseTex = new PNGTexture("blueNoiseTex", "textures/blueNoise.png", false, true);

    const debugTex = new Texture("debugTex")
        .format(Format.RGBA8)
        .imageName("debugImg")
        .width(1920).height(1080)
        .clear(true)
        .clearColor(0, 0, 0, 0)
        .build()

    // ======================= SETUP =======================

    const sunTransmittanceLUT = new Texture("sunTransmittanceLUTTex")
        .format(Format.RGBA16F)
        .imageName("sunTransmittanceLUT")
        .width(256).height(64)
        .clear(false)
        .build();

    registerShader(
        Stage.SCREEN_SETUP,
        new Compute("generateSunTransmittanceLUT")
        .location("program/sky/generateSunTransmittanceLUT.csh")
        .workGroups(32, 8, 1)
        .build()
    )

    const multipleScatteringLUT = new Texture("multipleScatteringLUTTex")
        .format(Format.RGBA16F)
        .imageName("multipleScatteringLUT")
        .width(32).height(32)
        .clear(false)
        .build();

    registerShader(
        Stage.SCREEN_SETUP,
        new Compute("generateMultipleScatteringLUT")
        .location("program/sky/generateMultipleScatteringLUT.csh")
        .workGroups(4, 4, 1)
        .build()
    )

    const skyViewLUT = new Texture("skyViewLUTTex")
        .format(Format.RGBA16F)
        .imageName("skyViewLUT")
        .width(200).height(200)
        .clear(true)
        .build()

    // ======================= PREPARE =======================

    registerShader(
        Stage.PRE_RENDER,
        new Compute("generateSkyViewLUT")
        .location("program/sky/generateSkyViewLUT.csh")
        .workGroups(25, 25, 1)
        .ssbo(0, sceneData)
        .build()
    )

    registerShader(
        Stage.PRE_RENDER,
        new Compute("getSkylightColor")
        .location("program/sky/getSkylightColor.csh")
        .workGroups(1, 1, 1)
        .ssbo(0, sceneData)
        .build()
    )

    // ======================= GBUFFERS =======================

    const sceneTex = new Texture("sceneTex")
        .format(Format.RGB16F)
        .clear(true)
        .build();

    const translucentsTex = new Texture("translucentsTex")
        .format(Format.RGBA16F)
        .clear(true)
        .clearColor(0, 0, 0, 0)
        .build();

    const gbufferDataTex1 = new Texture("gbufferDataTex1")
        .format(Format.RGBA16)
        .clear(true)
        .build()

    const gbufferDataTex2 = new Texture("gbufferDataTex2")
        .format(Format.RGBA16)
        .clear(true)
        .build()

    const shadowColorTex = new ArrayTexture("shadowColorTex")
        .format(Format.RGBA8)
        .clear(true)
        .build();

    const shadowNormalTex = new ArrayTexture("shadowNormalTex")
        .format(Format.RGBA8)
        .clear(true)
        .clearColor(0.0, 0.0, 0.0, 0.0)
        .build();

    const shadowPositionTex = new ArrayTexture("shadowPositionTex")
        .format(Format.RGB16F)
        .clear(true)
        .build()

    const deferredGbuffers = [
        Usage.TERRAIN_SOLID,
        Usage.TERRAIN_CUTOUT,
        Usage.ENTITY_SOLID,
        Usage.ENTITY_CUTOUT,
        Usage.BLOCK_ENTITY,
        Usage.PARTICLES
    ];

    const forwardGbuffers = [
        Usage.TERRAIN_TRANSLUCENT,
        Usage.ENTITY_TRANSLUCENT,
        Usage.BLOCK_ENTITY_TRANSLUCENT,
        Usage.PARTICLES_TRANSLUCENT,
        Usage.HAND
    ];

    deferredGbuffers.forEach(program => {
        registerShader(
            new ObjectShader("terrain", program)
            .vertex("program/gbuffer/main.vsh")
            .fragment("program/gbuffer/main.fsh")
            .target(0, sceneTex)
            .target(1, gbufferDataTex1)
            .target(2, gbufferDataTex2)
            .ssbo(0, sceneData)
            .build()
        );
    })

    forwardGbuffers.forEach(program => {
        registerShader(
            new ObjectShader("terrain", program)
            .vertex("program/gbuffer/main.vsh")
            .fragment("program/gbuffer/main.fsh")
            .target(0, translucentsTex)
            .target(1, gbufferDataTex1)
            .target(2, gbufferDataTex2)
            .define("FORWARD_LIGHTING", "1")
            .ssbo(0, sceneData)
            .build()
        );
    })


    registerShader(
        new ObjectShader("terrain", Usage.CLOUDS)
        .vertex("program/gbuffer/discard.vsh")
        .fragment("program/gbuffer/discard.fsh")
        .build()
    );

    registerShader(
        new ObjectShader("shadow", Usage.SHADOW)
        .vertex("program/gbuffer/shadow.vsh")
        .fragment("program/gbuffer/shadow.fsh")
        .target(0, shadowColorTex)
        .target(1, shadowNormalTex)
        .target(2, shadowPositionTex)
        .build()
    );

    // ======================= DEFERRED =======================

    const globalIlluminationTex = new Texture("globalIlluminationTex")
        .format(Format.R11F_G11F_B10F)
        .clear(false)
        .width(Math.floor(screenWidth / 4)).height(Math.floor(screenHeight / 4))
        .build();

    registerShader(
        Stage.PRE_TRANSLUCENT,
        new Composite("globalIllumination")
        .vertex("program/fullscreen.vsh")
        .fragment("program/composite/globalIllumination.fsh")
        .target(0, globalIlluminationTex)
        .build()
    )

    registerShader(
        Stage.PRE_TRANSLUCENT,
        new Composite("compositeSky")
        .vertex("program/fullscreen.vsh")
        .fragment("program/composite/compositeSky.fsh")
        .target(0, sceneTex)
        .build()
    );

    registerShader(
        Stage.PRE_TRANSLUCENT,
        new Composite("deferredShading")
        .vertex("program/fullscreen.vsh")
        .fragment("program/composite/deferredShading.fsh")
        .target(0, sceneTex)
        .ssbo(0, sceneData)
        .build()
    );

    // ======================= COMPOSITES =======================

    registerShader(
        Stage.POST_RENDER,
        new Composite("compositeTranslucents")
        .vertex("program/fullscreen.vsh")
        .fragment("program/composite/compositeTranslucents.fsh")
        .target(0, sceneTex)
        .ssbo(0, sceneData)
        .build()
    );

    // ======================= POST =======================

    const previousSceneTex = new Texture("previousSceneTex")
        .format(Format.RGB16F)
        .clear(false)
        .mipmap(true)
        .build();

    const previousDepthTex = new Texture("previousDepthTex")
        .format(Format.RG16)
        .clear(false)
        .build();

    registerShader(
        Stage.POST_RENDER,
        new Composite("temporalFilter")
            .vertex("program/fullscreen.vsh")
            .fragment("program/post/temporalFilter.fsh")
            .target(0, sceneTex)
            .build()
    );

    registerShader(
        Stage.POST_RENDER,
        new Composite("copyHistory")
            .vertex("program/fullscreen.vsh")
            .fragment("program/post/copyHistory.fsh")
            .target(0, previousSceneTex)
            .target(1, previousDepthTex)
            .build()
    );

    registerShader(
        Stage.POST_RENDER,
        new Composite("generateHistoryMips")
            .vertex("program/discard.vsh")
            .fragment("program/discard.fsh")
            .generateMips(previousSceneTex)
            .build()
    );


    if(getBoolSetting("BLOOM_ENABLE")){
        const bloomTex = new Texture("bloomTex")
            .format(Format.RGB16F)
            .clear(true)
            .mipmap(true)
            .build();

        for(let i = 0; i < 8; i++){
            registerShader(
                Stage.POST_RENDER,
                new Composite(`bloomDownsample${i}-${i+1}`)
                .vertex("program/fullscreen.vsh")
                .fragment("program/post/bloomDownsample.fsh")
                .target(0, bloomTex, i + 1)
                .define("BLOOM_INDEX", i.toString())
                .build()
            )
        }
    
        for(let i = 8; i > 0; i -= 1){
            registerShader(
                Stage.POST_RENDER,
                new Composite(`bloomUpsample${i}-${i-1}`)
                .vertex("program/fullscreen.vsh")
                .fragment("program/post/bloomUpsample.fsh")
                .target(0, bloomTex, i - 1)
                .define("BLOOM_INDEX", i.toString())
                .build()
            )
        }
    }

    setCombinationPass(
        new CombinationPass("program/final.fsh")
        .build()
    );
}
