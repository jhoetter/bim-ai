# THREE.js allocation inventory (PERF-I06)

Scanned roots: `packages/web/src/viewport`, `packages/web/src/Viewport.tsx`
Total allocations: `217`

## By pattern

| Pattern          | Count |
| ---------------- | ----: |
| `material_alloc` |    92 |
| `geometry_alloc` |   116 |
| `texture_alloc`  |     9 |

## By kind

| Kind                   | Count |
| ---------------------- | ----: |
| `BoxGeometry`          |    57 |
| `MeshStandardMaterial` |    42 |
| `BufferGeometry`       |    41 |
| `MeshBasicMaterial`    |    23 |
| `LineBasicMaterial`    |    18 |
| `PlaneGeometry`        |     9 |
| `SpriteMaterial`       |     6 |
| `CanvasTexture`        |     5 |
| `SphereGeometry`       |     3 |
| `CylinderGeometry`     |     3 |
| `Texture`              |     3 |
| `LineDashedMaterial`   |     2 |
| `PointsMaterial`       |     1 |
| `RingGeometry`         |     1 |
| `CircleGeometry`       |     1 |
| `ConeGeometry`         |     1 |
| `DataTexture`          |     1 |

## Per-call-site

| Severity | Kind                   | Location                                                        |
| -------- | ---------------------- | --------------------------------------------------------------- |
| high     | `BufferGeometry`       | `packages/web/src/Viewport.tsx:747`                             |
| high     | `LineBasicMaterial`    | `packages/web/src/Viewport.tsx:1294`                            |
| high     | `MeshBasicMaterial`    | `packages/web/src/Viewport.tsx:1308`                            |
| high     | `BoxGeometry`          | `packages/web/src/viewport/beamProfileMesh.ts:151`              |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/beamProfileMesh.ts:162`              |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/buildFloorEdgeProfile.ts:27`         |
| high     | `BoxGeometry`          | `packages/web/src/viewport/csgWallBaseGeometry.ts:16`           |
| high     | `BoxGeometry`          | `packages/web/src/viewport/csgWallBaseGeometry.ts:36`           |
| high     | `BoxGeometry`          | `packages/web/src/viewport/csgWorker.ts:98`                     |
| high     | `BoxGeometry`          | `packages/web/src/viewport/csgWorker.ts:128`                    |
| high     | `BoxGeometry`          | `packages/web/src/viewport/csgWorker.ts:143`                    |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/dormerMesh.ts:128`                   |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/dormerMesh.ts:137`                   |
| high     | `BoxGeometry`          | `packages/web/src/viewport/dormerMesh.ts:154`                   |
| high     | `BoxGeometry`          | `packages/web/src/viewport/dormerMesh.ts:165`                   |
| high     | `BoxGeometry`          | `packages/web/src/viewport/dormerMesh.ts:187`                   |
| high     | `BoxGeometry`          | `packages/web/src/viewport/dormerMesh.ts:198`                   |
| high     | `BoxGeometry`          | `packages/web/src/viewport/dormerMesh.ts:248`                   |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/dormerMesh.ts:274`                   |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/dormerMesh.ts:282`                   |
| high     | `BoxGeometry`          | `packages/web/src/viewport/dormerMesh.ts:300`                   |
| high     | `BoxGeometry`          | `packages/web/src/viewport/dormerMesh.ts:309`                   |
| high     | `BoxGeometry`          | `packages/web/src/viewport/dormerMesh.ts:317`                   |
| high     | `BoxGeometry`          | `packages/web/src/viewport/dormerMesh.ts:330`                   |
| high     | `BoxGeometry`          | `packages/web/src/viewport/dormerMesh.ts:339`                   |
| high     | `BoxGeometry`          | `packages/web/src/viewport/dormerMesh.ts:347`                   |
| high     | `BufferGeometry`       | `packages/web/src/viewport/dormerMesh.ts:394`                   |
| high     | `BufferGeometry`       | `packages/web/src/viewport/dormerMesh.ts:442`                   |
| high     | `BufferGeometry`       | `packages/web/src/viewport/dormerRoofCut.ts:38`                 |
| high     | `BoxGeometry`          | `packages/web/src/viewport/dormerRoofCut.ts:99`                 |
| high     | `SphereGeometry`       | `packages/web/src/viewport/grip3dRenderer.ts:70`                |
| high     | `MeshBasicMaterial`    | `packages/web/src/viewport/grip3dRenderer.ts:75`                |
| high     | `SpriteMaterial`       | `packages/web/src/viewport/grip3dRenderer.ts:98`                |
| high     | `LineBasicMaterial`    | `packages/web/src/viewport/grip3dRenderer.ts:150`               |
| high     | `BufferGeometry`       | `packages/web/src/viewport/grip3dRenderer.ts:156`               |
| high     | `LineBasicMaterial`    | `packages/web/src/viewport/levelDatums3d.ts:105`                |
| high     | `BufferGeometry`       | `packages/web/src/viewport/levelDatums3d.ts:111`                |
| high     | `LineBasicMaterial`    | `packages/web/src/viewport/levelDatums3d.ts:124`                |
| high     | `BufferGeometry`       | `packages/web/src/viewport/levelDatums3d.ts:130`                |
| high     | `PlaneGeometry`        | `packages/web/src/viewport/levelDatums3d.ts:159`                |
| high     | `MeshBasicMaterial`    | `packages/web/src/viewport/levelDatums3d.ts:160`                |
| high     | `SpriteMaterial`       | `packages/web/src/viewport/levelDatums3d.ts:181`                |
| medium   | `CanvasTexture`        | `packages/web/src/viewport/levelDatums3d.ts:222`                |
| high     | `SpriteMaterial`       | `packages/web/src/viewport/levelDatums3d.ts:224`                |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.balcony.ts:40`          |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.balcony.ts:45`          |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.balcony.ts:52`          |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.balcony.ts:65`          |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.beamSystem.ts:93`       |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.brace.ts:27`            |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.coneRoof.ts:15`         |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.coneRoof.ts:33`         |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.coneRoof.ts:52`         |
| high     | `BufferGeometry`       | `packages/web/src/viewport/meshBuilders.familyBlend.ts:18`      |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.familyBlend.ts:19`      |
| high     | `BufferGeometry`       | `packages/web/src/viewport/meshBuilders.familyBlend.ts:129`     |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.familyBlend.ts:133`     |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.familyDetail.ts:78`     |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.familyDetail.ts:135`    |
| high     | `BufferGeometry`       | `packages/web/src/viewport/meshBuilders.familyDetail.ts:135`    |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.familyDetail.ts:149`    |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.familyDetail.ts:161`    |
| high     | `BufferGeometry`       | `packages/web/src/viewport/meshBuilders.familyDetail.ts:168`    |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.familyDetail.ts:169`    |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.familyDetail.ts:184`    |
| high     | `PlaneGeometry`        | `packages/web/src/viewport/meshBuilders.familyDetail.ts:197`    |
| high     | `MeshBasicMaterial`    | `packages/web/src/viewport/meshBuilders.familyDetail.ts:198`    |
| high     | `SpriteMaterial`       | `packages/web/src/viewport/meshBuilders.familyDetail.ts:219`    |
| medium   | `CanvasTexture`        | `packages/web/src/viewport/meshBuilders.familyDetail.ts:245`    |
| high     | `LineDashedMaterial`   | `packages/web/src/viewport/meshBuilders.familyDetail.ts:272`    |
| high     | `LineBasicMaterial`    | `packages/web/src/viewport/meshBuilders.familyDetail.ts:274`    |
| high     | `BufferGeometry`       | `packages/web/src/viewport/meshBuilders.familyDetail.ts:277`    |
| high     | `BufferGeometry`       | `packages/web/src/viewport/meshBuilders.familySweep.ts:14`      |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.familySweep.ts:15`      |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.familySweep.ts:45`      |
| high     | `BufferGeometry`       | `packages/web/src/viewport/meshBuilders.familySweptBlend.ts:52` |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.familySweptBlend.ts:57` |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.gradedRegion.ts:22`     |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.layeredWall.ts:51`      |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.layeredWall.ts:59`      |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.layeredWall.ts:233`     |
| high     | `LineBasicMaterial`    | `packages/web/src/viewport/meshBuilders.mass.ts:65`             |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.massBox.ts:13`          |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.multiRunStair.ts:160`   |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.multiRunStair.ts:437`   |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.osmContext.ts:55`       |
| high     | `BufferGeometry`       | `packages/web/src/viewport/meshBuilders.osmContext.ts:109`      |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.osmContext.ts:139`      |
| high     | `BufferGeometry`       | `packages/web/src/viewport/meshBuilders.osmContext.ts:168`      |
| high     | `PointsMaterial`       | `packages/web/src/viewport/meshBuilders.osmContext.ts:173`      |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.osmContext.ts:221`      |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.osmContext.ts:261`      |
| high     | `BufferGeometry`       | `packages/web/src/viewport/meshBuilders.ramp.ts:89`             |
| high     | `LineBasicMaterial`    | `packages/web/src/viewport/meshBuilders.ramp.ts:107`            |
| high     | `BufferGeometry`       | `packages/web/src/viewport/meshBuilders.ramp.ts:113`            |
| high     | `BufferGeometry`       | `packages/web/src/viewport/meshBuilders.ramp.ts:125`            |
| high     | `BufferGeometry`       | `packages/web/src/viewport/meshBuilders.ramp.ts:181`            |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.ramp.ts:186`            |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.structural.ts:21`       |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.structural.ts:99`       |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.structural.ts:106`      |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.structural.ts:109`      |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.structural.ts:112`      |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.structural.ts:118`      |
| high     | `CylinderGeometry`     | `packages/web/src/viewport/meshBuilders.structural.ts:143`      |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.terrainPad.ts:17`       |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.ts:676`                 |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.ts:803`                 |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.ts:824`                 |
| high     | `BufferGeometry`       | `packages/web/src/viewport/meshBuilders.ts:982`                 |
| high     | `LineBasicMaterial`    | `packages/web/src/viewport/meshBuilders.ts:983`                 |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.ts:1117`                |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.ts:1136`                |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.ts:1179`                |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.ts:1187`                |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.ts:1250`                |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.ts:1263`                |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.ts:1381`                |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.ts:1384`                |
| high     | `BufferGeometry`       | `packages/web/src/viewport/meshBuilders.ts:1514`                |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.ts:1655`                |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.ts:1861`                |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.ts:1888`                |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.ts:1893`                |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.ts:1923`                |
| high     | `PlaneGeometry`        | `packages/web/src/viewport/meshBuilders.ts:2031`                |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.ts:2052`                |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.ts:2062`                |
| high     | `BufferGeometry`       | `packages/web/src/viewport/meshBuilders.ts:2110`                |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.ts:2131`                |
| high     | `BufferGeometry`       | `packages/web/src/viewport/meshBuilders.ts:2240`                |
| high     | `LineBasicMaterial`    | `packages/web/src/viewport/meshBuilders.ts:2243`                |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.ts:2302`                |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.ts:2319`                |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.ts:2341`                |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.ts:2352`                |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.ts:2363`                |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.ts:2426`                |
| high     | `BufferGeometry`       | `packages/web/src/viewport/meshBuilders.ts:2558`                |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.ts:2602`                |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.ts:2641`                |
| medium   | `Texture`              | `packages/web/src/viewport/meshBuilders.ts:2661`                |
| high     | `PlaneGeometry`        | `packages/web/src/viewport/meshBuilders.ts:2719`                |
| medium   | `Texture`              | `packages/web/src/viewport/meshBuilders.ts:2723`                |
| high     | `MeshBasicMaterial`    | `packages/web/src/viewport/meshBuilders.ts:2724`                |
| high     | `MeshBasicMaterial`    | `packages/web/src/viewport/meshBuilders.ts:2732`                |
| high     | `BufferGeometry`       | `packages/web/src/viewport/meshBuilders.ts:2846`                |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.wallProfile.ts:34`      |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/meshBuilders.windowFrame.ts:39`      |
| high     | `BoxGeometry`          | `packages/web/src/viewport/meshBuilders.windowFrame.ts:54`      |
| high     | `BufferGeometry`       | `packages/web/src/viewport/originMarkers.ts:23`                 |
| high     | `LineBasicMaterial`    | `packages/web/src/viewport/originMarkers.ts:24`                 |
| high     | `SphereGeometry`       | `packages/web/src/viewport/originMarkers.ts:39`                 |
| high     | `MeshBasicMaterial`    | `packages/web/src/viewport/originMarkers.ts:40`                 |
| high     | `RingGeometry`         | `packages/web/src/viewport/originMarkers.ts:55`                 |
| high     | `MeshBasicMaterial`    | `packages/web/src/viewport/originMarkers.ts:57`                 |
| high     | `LineBasicMaterial`    | `packages/web/src/viewport/originMarkers.ts:66`                 |
| high     | `BufferGeometry`       | `packages/web/src/viewport/originMarkers.ts:72`                 |
| high     | `BufferGeometry`       | `packages/web/src/viewport/originMarkers.ts:79`                 |
| high     | `BufferGeometry`       | `packages/web/src/viewport/originMarkers.ts:109`                |
| high     | `LineBasicMaterial`    | `packages/web/src/viewport/originMarkers.ts:110`                |
| high     | `LineBasicMaterial`    | `packages/web/src/viewport/placedAssetRendering.ts:225`         |
| high     | `MeshBasicMaterial`    | `packages/web/src/viewport/placedAssetRendering.ts:234`         |
| high     | `PlaneGeometry`        | `packages/web/src/viewport/placedAssetRendering.ts:254`         |
| high     | `CircleGeometry`       | `packages/web/src/viewport/placedAssetRendering.ts:274`         |
| high     | `BufferGeometry`       | `packages/web/src/viewport/placedAssetRendering.ts:293`         |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/placedAssetRendering.ts:850`         |
| high     | `LineBasicMaterial`    | `packages/web/src/viewport/placedAssetRendering.ts:856`         |
| high     | `BoxGeometry`          | `packages/web/src/viewport/placedAssetRendering.ts:872`         |
| high     | `CylinderGeometry`     | `packages/web/src/viewport/placedAssetRendering.ts:891`         |
| high     | `ConeGeometry`         | `packages/web/src/viewport/placedAssetRendering.ts:909`         |
| high     | `BufferGeometry`       | `packages/web/src/viewport/planOverlay3d.ts:175`                |
| high     | `MeshBasicMaterial`    | `packages/web/src/viewport/planOverlay3d.ts:181`                |
| high     | `BufferGeometry`       | `packages/web/src/viewport/planOverlay3d.ts:202`                |
| high     | `LineDashedMaterial`   | `packages/web/src/viewport/planOverlay3d.ts:206`                |
| high     | `MeshBasicMaterial`    | `packages/web/src/viewport/planOverlay3d.ts:230`                |
| medium   | `CanvasTexture`        | `packages/web/src/viewport/planOverlay3d.ts:294`                |
| high     | `SpriteMaterial`       | `packages/web/src/viewport/planOverlay3d.ts:297`                |
| medium   | `DataTexture`          | `packages/web/src/viewport/proceduralMaterials.ts:71`           |
| high     | `PlaneGeometry`        | `packages/web/src/viewport/referencePlaneMarker.ts:60`          |
| high     | `MeshBasicMaterial`    | `packages/web/src/viewport/referencePlaneMarker.ts:61`          |
| high     | `LineBasicMaterial`    | `packages/web/src/viewport/referencePlaneMarker.ts:87`          |
| high     | `BufferGeometry`       | `packages/web/src/viewport/roofGeometry.ts:211`                 |
| high     | `BufferGeometry`       | `packages/web/src/viewport/roofGeometry.ts:407`                 |
| high     | `BufferGeometry`       | `packages/web/src/viewport/roofGeometry.ts:643`                 |
| high     | `BufferGeometry`       | `packages/web/src/viewport/roofGeometry.ts:704`                 |
| high     | `BufferGeometry`       | `packages/web/src/viewport/roofGeometry.ts:833`                 |
| high     | `BufferGeometry`       | `packages/web/src/viewport/roofGeometry.ts:961`                 |
| high     | `LineBasicMaterial`    | `packages/web/src/viewport/sceneHelpers.ts:81`                  |
| high     | `PlaneGeometry`        | `packages/web/src/viewport/sceneUtils.ts:148`                   |
| high     | `MeshBasicMaterial`    | `packages/web/src/viewport/sceneUtils.ts:149`                   |
| high     | `BufferGeometry`       | `packages/web/src/viewport/sweepMesh.ts:310`                    |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/text3dGeometry.ts:81`                |
| medium   | `Texture`              | `packages/web/src/viewport/threeMaterialFactory.ts:157`         |
| high     | `MeshStandardMaterial` | `packages/web/src/viewport/threeMaterialFactory.ts:299`         |
| high     | `MeshBasicMaterial`    | `packages/web/src/viewport/useViewportSceneEffects.ts:1492`     |
| high     | `MeshBasicMaterial`    | `packages/web/src/viewport/useViewportSceneEffects.ts:1510`     |
| high     | `BufferGeometry`       | `packages/web/src/viewport/useViewportSceneEffects.ts:1794`     |
| high     | `LineBasicMaterial`    | `packages/web/src/viewport/useViewportSceneEffects.ts:1795`     |
| high     | `MeshBasicMaterial`    | `packages/web/src/viewport/useViewportSceneEffects.ts:1814`     |
| high     | `PlaneGeometry`        | `packages/web/src/viewport/useViewportSceneEffects.ts:1830`     |
| medium   | `CanvasTexture`        | `packages/web/src/viewport/useViewportSceneEffects.ts:1984`     |
| high     | `SpriteMaterial`       | `packages/web/src/viewport/useViewportSceneEffects.ts:1989`     |
| high     | `PlaneGeometry`        | `packages/web/src/viewport/ViewCube.tsx:591`                    |
| high     | `MeshBasicMaterial`    | `packages/web/src/viewport/ViewCube.tsx:595`                    |
| high     | `MeshBasicMaterial`    | `packages/web/src/viewport/ViewCube.tsx:605`                    |
| high     | `MeshBasicMaterial`    | `packages/web/src/viewport/ViewCube.tsx:622`                    |
| high     | `BoxGeometry`          | `packages/web/src/viewport/ViewCube.tsx:638`                    |
| high     | `LineBasicMaterial`    | `packages/web/src/viewport/ViewCube.tsx:644`                    |
| high     | `MeshBasicMaterial`    | `packages/web/src/viewport/ViewCube.tsx:648`                    |
| high     | `MeshBasicMaterial`    | `packages/web/src/viewport/ViewCube.tsx:653`                    |
| high     | `MeshBasicMaterial`    | `packages/web/src/viewport/ViewCube.tsx:671`                    |
| high     | `MeshBasicMaterial`    | `packages/web/src/viewport/ViewCube.tsx:676`                    |
| high     | `SphereGeometry`       | `packages/web/src/viewport/ViewCube.tsx:683`                    |
| high     | `BoxGeometry`          | `packages/web/src/viewport/ViewCube.tsx:693`                    |
| medium   | `CanvasTexture`        | `packages/web/src/viewport/ViewCube.tsx:767`                    |
| high     | `CylinderGeometry`     | `packages/web/src/viewport/ViewCube.tsx:787`                    |
