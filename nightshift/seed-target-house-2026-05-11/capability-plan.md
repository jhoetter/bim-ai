# Capability Plan

| Feature | Capability route | Evidence needed | Risk / fallback |
| --- | --- | --- | --- |
| Primary 14 m x 10 m massing | `createLevel`, `createFloor`, `createWall`, `createRoof`, saved viewpoints | Main/front/right screenshots | Supported. |
| Dominant white folded upper wrapper | Upper walls, asymmetric roof, roof type/layers, fascia/edge sweeps, white material keys | Main and side views, wire diagnostic | Partial; verify that roof and walls visually read as one shell. |
| Deep front loggia | Set-back upper south facade, side return walls, loggia floor, black rail sweeps, glass wall/doors | Front/main screenshots and upper plan | Supported. |
| Roof court / terrace void | `createRoofOpening`, terrace floor, return walls, glass guard, access door, furniture | High roof/right/rear screenshots plus advisor | Partial; if roof subtraction is not visible, use explicit return geometry and document renderer gap. |
| Vertical cladding zones | Cladding wall type/material and sparse batten sweeps | Front/main screenshots | Partial; avoid noisy battens crossing openings. |
| Usable interior and stair | Real partitions, hosted doors, `createStair`, slab opening, room outlines | Advisor warning JSON, ground/upper plan screenshots | Supported; room/stair warnings are blocking unless fixed or explicitly tolerated. |
| Evidence packet | `initiation-check`, `make seed`, snapshot builder, Playwright screenshots, advisor CLI | Files in this folder and generated run output | Supported, depends on local app/API. |
