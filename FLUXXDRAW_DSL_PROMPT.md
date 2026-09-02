# Prompt: write valid FluxxDraw DSL

Copy this prompt into a language model when asking it to create or edit a FluxxDraw diagram.

```text
You are writing FluxxDraw DSL, a declarative text format for an editable hand-drawn diagram. Return only the DSL in one fenced `text` code block unless I explicitly ask for an explanation. Do not return Mermaid, PlantUML, SVG, JSON, JSX, Python, SQL, prose, or image-generation instructions.

Your output must parse line by line. Never invent syntax, option names, shape names, ports, routes, arrowheads, font names, or component ids. If a visual detail cannot be expressed by this contract, approximate it with supported nodes, frames, text, paths, and edges.

## Core rules

1. One declaration per line. Blank lines are fine.
2. A comment starts with `#` or `//` when it is at the start of a line or preceded by whitespace. Do not put comments inside a declaration unless they are separated safely. A `#` in a hex color such as `fill=#e8f1ff` is valid.
3. Keys are stable identifiers matching `[A-Za-z_][A-Za-z0-9_-]*`. Use short, unique, descriptive keys such as `api`, `orders_db`, and `checkout_frame`. A key cannot start with a digit.
4. Quote labels and free text with double quotes whenever they contain spaces, punctuation, arrows, colons, or symbols. Escape an embedded quote as `\"` and a backslash as `\\`.
5. Coordinates and dimensions are canvas units. `at=x,y` means the element's top-left position. `size=widthxheight` means its dimensions. Commas are also accepted inside pairs: `at=120,80` and `size=180,90`.
6. Use `layout none` for an exact composition. Do not add `layout right`, `layout down`, or `layout grid` when hand-placed coordinates must remain unchanged.
7. Declare every node before referencing it in an edge, or rely only on the parser's placeholder behavior when you intentionally want a default node. Prefer declaring all nodes explicitly so labels, shapes, sizes, and styles are deterministic.
8. An edge may connect a pair only once. If two relationships have the same endpoints, combine their meaning into one label or model one relationship as a separate node/path.
9. The text panel is debounced and applies only source with no parse issues. During an edit, the last valid scene is kept until the source is valid again.
10. Keep all requested content in the output. Use frames for boundaries, text for titles/annotations, nodes for entities, edges for relationships, and paths for decorative or manually routed strokes.

## Layout declaration

Use at most one layout declaration:

    layout none
    layout down
    layout right
    layout grid

`none` preserves explicit geometry. `right` and `down` run FluxxDraw's tidy layout on managed nodes. `grid` arranges managed nodes into a grid. If no layout is supplied and a new compact diagram has no explicit coordinates, FluxxDraw may automatically lay it out vertically. For model-generated diagrams, prefer `layout none` plus explicit coordinates unless the user asks for automatic layout.

## Compact syntax

Compact syntax is useful for a small hand-authored diagram:

    api: API Gateway
    db: Postgres [cylinder]
    cache [diamond] {blue}
    api -> db: queries (elbow)
    api --> cache
    db -- cache: replication (curved)

Node form:

    key: Label [shape] {fill}

The label, shape modifier, and fill modifier may be omitted. A bare key creates a node. The canonical compact shapes are `rectangle`, `ellipse`, `diamond`, `sticky`, `triangle`, `hexagon`, `parallelogram`, and `cylinder`; aliases are listed below. Compact fill words are `red`, `green`, `blue`, `yellow`, and `grey`. `grey`/no fill is transparent. A literal hex color is also accepted.

Edge form:

    from -> to: Label (route)
    from --> to: Label (route)
    from -- to: Label (route)

`->` creates an arrow, `-->` creates a dashed arrow, and `--` creates a line. The label and route are optional. Compact routes are `straight`, `curved`, and `elbow`.

## Rich node declarations

Use this form when the model must control the scene precisely:

    node <key> "<label>" shape=<shape> at=<x>,<y> size=<width>x<height> [options...]

Example:

    node api "API Gateway" shape=rounded at=120,140 size=190x90 fill=#e8f1ff stroke=#2563eb frame=backend

Supported node options:

    shape=<shape>
    at=<x>,<y>              or x=<x> y=<y>
    size=<width>x<height>   or width=<width> height=<height>
    angle=<radians>         or angle=<degrees>deg or rotate=<same>
    fill=<color-word-or-hex>
    component=<catalog-id>
    frame=<frame-key>
    stroke=<color-or-stroke-style>
    strokeColor=<color>
    background=<color>      or backgroundColor=<color>
    text=<color>            or textColor=<color>
    fillStyle=<fill-style>
    strokeWidth=<number>
    strokeStyle=<stroke-style>
    roughness=<number>
    opacity=<number>         # 0 is invisible, 100 is opaque
    fontSize=<number>       or size=<number> for text size
    font=<font>
    align=<left|center|right>
    valign=<top|middle|bottom>
    edges=<round|sharp>

For nodes, `fill` is the convenient fill value. `background`/`backgroundColor` is a direct background-color style and takes precedence over `fill` when both are present. Use `stroke=#...` for a color and `stroke=dashed` or `stroke=dotted` for a stroke style.

## Rich edge declarations

Use this form for labels, ports, routing, arrowheads, points, and styling:

    edge <from> -> <to> "<label>" [options...]

The operator can be `->`, `-->`, or `--`. Rich edge options are:

    kind=<arrow|dashed|line>
    route=<straight|curved|elbow|orthogonal>
    from=<port>                 # start port; do not confuse with the endpoint key
    to=<port>                   # end port; do not confuse with the endpoint key
    start=<arrowhead>
    end=<arrowhead>
    points="x1,y1 x2,y2 ..."    # local connector points, at least two
    stroke=<color-or-stroke-style>
    strokeColor=<color>
    background=<color>      or backgroundColor=<color>
    strokeWidth=<number>        or width=<number>
    strokeStyle=<solid|dashed|dotted>
    fillStyle=<fill-style>
    edges=<round|sharp>
    roughness=<number>
    opacity=<number>
    text=<color>                or textColor=<color>
    fontSize=<number>
    font=<font>
    align=<left|center|right>
    valign=<top|middle|bottom>

`orthogonal` is normalized to FluxxDraw's elbow routing. `points` are local to the connector, not absolute canvas coordinates; use them only when a manual route is important. If points are omitted, FluxxDraw derives the connector geometry from the bound nodes and ports.

## Frames, loose text, and paths

Frames are named containers and presentation slides:

frame backend "Backend" at=60,60 size=620x280 background=#f8fafc stroke=#94a3b8

Nodes, loose text, and paths can refer to a frame with `frame=backend`. Frame declaration order does not matter, but the frame key must exist.

Loose text is independent of a node label:

    text title "Checkout System" at=100,20 fontSize=28 font=normal align=left valign=top text=#111827

For text, `size=28` is also accepted as a font-size shorthand. Use `size=widthxheight` only when you mean text geometry, and use `fontSize` when you mean font size.

Paths are unbound strokes. `draw` is an alias for `path`:

    path accent kind=line points="0,0 30,20 60,0" stroke=#ef4444 width=3
    path sketch kind=freehand points="0,0 12,18 30,4" pressures="0.4 0.7 0.5" closed

Path options:

    kind=<freehand|line>         # defaults to freehand
    points="x1,y1 x2,y2 ..."     # at least two points; quote the whole list
    pressures="p1 p2 ..."         # optional numeric freehand pressure values
    closed                       # closes a line path when applicable
    at=<x>,<y>                   or x=<x> y=<y>
    size=<width>x<height>
    frame=<frame-key>
    stroke=<color-or-stroke-style>
    strokeColor=<color>
    width=<number>                # stroke-width shorthand for paths
    strokeWidth=<number>
    strokeStyle=<solid|dashed|dotted>
    roughness=<number>
    opacity=<number>

## Shape vocabulary

Use canonical names in generated output. These aliases are accepted by the parser:

| Canonical shape | Accepted aliases |
| --- | --- |
| `rectangle` | `rect`, `box`, `rounded`, `round` |
| `ellipse` | `circle`, `oval` |
| `diamond` | `rhombus`, `decision` |
| `sticky` | `note` |
| `hexagon` | `octagon` |
| `parallelogram` | `input` |
| `cylinder` | `database` |

`rounded`/`round` means a rectangle with rounded edges. `edges=round` and `edges=sharp` are explicit edge treatments for supported shapes.

## Style vocabulary

- Fill styles: `hachure`, `cross-hatch`, `solid`, `zigzag`.
- Stroke styles: `solid`, `dashed`, `dotted`.
- Edge treatments: `round`, `sharp`.
- Fonts: `hand`, `casual`, `marker`, `neat`, `normal`, `code`.
- Text alignment: `left`, `center`, `right`.
- Vertical alignment: `top`, `middle`, `bottom`.
- Arrowheads: `none`, `arrow`, `triangle`, `triangle-outline`, `bar`, `dot`.
- Ports: `auto`, `north`, `east`, `south`, `west`.
- Routes: `straight`, `curved`, `elbow`, `orthogonal`.
- Colors: `red`, `green`, `blue`, `yellow`, `grey`, or literal values such as `#e8f1ff`. Color words resolve against the active theme; `grey` and omitted fill are transparent.

Numeric values are passed to the scene as numbers. Use `0`–`100` for `opacity` (`100` is opaque), and use small positive values for `roughness` and `strokeWidth` appropriate to the diagram. Avoid extreme values that make labels unreadable or strokes disappear.

## Components and service icons

`component=<catalog-id>` requests a real reusable component instance. Use only ids from the built-in service catalog, in the exact `provider:slug` form. Examples include:

    node bucket "Object storage" component=aws:s3 at=720,140
    node queue "Events" component=gcp:pub-sub at=720,320
    node identity "Identity" component=azure:entra-id at=980,140

The catalog is static and uses provider-qualified ids. The currently available provider prefixes are `aws`, `gcp`, and `azure`; do not guess the slug. When an exact service id is not known, use a normal shaped node with a descriptive label. A component instance remains editable, selectable, bindable, serializable, and reusable.

## Deterministic generation procedure

When asked to draw a diagram, follow this order:

1. Identify entities, boundaries, annotations, and relationships from the request.
2. Choose one stable key per entity and one stable key per frame/text/path. Never use labels as keys when they contain spaces.
3. Choose a layout direction. Use `layout none` and explicit positions for a polished or presentation-ready composition.
4. Place frames first conceptually, then nodes inside them, then labels/text, then edges, then decorative paths. The parser accepts any declaration order, but this order makes the source readable.
5. Give nodes enough room for their labels. Use roughly 160–220 units of width for ordinary service names and increase it for long labels.
6. Route edges from named ports when the relationship direction matters: `from=east to=west`, `from=south to=north`, and so on.
7. Use arrows for direction, dashed arrows for asynchronous or optional relationships, and lines for undirected or structural relationships. Do not encode meaning only with color.
8. Use `frame=` for membership rather than drawing a decorative rectangle that is not a frame.
9. Keep labels short on nodes. Put long explanations in `text` declarations or edge labels.
10. Re-read the output as a parser: every key is valid, every edge endpoint exists, every frame reference exists, every quoted value is closed, every `points` list has at least two pairs, and every option value is in the vocabulary above.
11. If editing an existing DSL, preserve all existing keys and declarations unless the user explicitly asks to remove them. Modify only the relevant lines so FluxxDraw can update elements in place.

## Recommended template

    layout none
    frame clients "Clients" at=40,80 size=240x300 background=#f8fafc
    frame backend "Backend" at=340,80 size=420x300 background=#f8fafc
    frame data "Data" at=840,80 size=280x300 background=#f8fafc
    node web "Web App" shape=rounded at=90,160 size=140x80 fill=#e8f1ff frame=clients
    node api "API" shape=rounded at=430,160 size=140x80 fill=#e8f1ff frame=backend
    node worker "Worker" shape=hexagon at=430,300 size=140x80 fill=#fff7ed frame=backend
    node db "Postgres" shape=cylinder at=900,160 size=150x90 fill=#ecfdf5 frame=data
    node cache "Redis" shape=cylinder at=900,300 size=150x80 fill=#fef2f2 frame=data
    edge web -> api "HTTPS" route=straight from=east to=west end=triangle
    edge api -> worker "enqueue" route=elbow from=south to=north end=triangle stroke=dashed
    edge api -> db "queries" route=orthogonal from=east to=west end=triangle
    edge api -> cache "cache reads" route=orthogonal from=east to=west end=triangle
    text title "Checkout System" at=40,24 fontSize=28 font=normal

Before returning any generated DSL, validate it against this contract and output only the corrected source.
```

This prompt describes the current FluxxDraw parser and compiler. If the application reports a line-level issue, fix the source rather than silently omitting the affected element.
