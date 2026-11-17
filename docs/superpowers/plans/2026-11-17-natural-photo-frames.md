# Natural photo frames on quest sheets

User reports portrait pictures boxed inside a horizontal frame. Current A4 CSS fixes the container at126×84 while its image fills that box with contain, leaving landscape-shaped framing regardless of the picture.

- [x] Change only A4 presentation: frame max-content width/auto height, max126px; intrinsic image width/height auto bounded116×148px. Existing padding/border give max outer126×162, at(24,158), preserving text column x160 and footer y351+. Portrait/square/landscape frames follow the image; no crop or stretch. All views/clones share CSS, no image-load scripting or schema/asset changes.
- [x] Keep tall left images clear of automatic impressions: default rectangle/banner width120 and auto right16; seal90/custom104 unchanged. Explicit user-positioned marks retain their anchors/sizes. Reviewed rotated paint bounds and tape decoration, not just unrotated boxes.
- [x] Independent source review plus existing image/model/folio/reader/stamp integration tests and syntax. npm test485/485; npm run check28 modules passed. Reviewer found no concrete blocking issue; calculated photo/frame rightmost150.84 versus rectangle outline left153.93, footer starts351.29 after photo bottom320.66. This reversible CSS change gets no tests copying CSS declarations; actual browser appearance remains unverified under existing managed browser denial. README/verification updated.

Root owns a4-paper.css/docs; reviewer read-only. No real quest/backup access, dependencies, publication or data migration.
