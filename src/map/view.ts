import { ItemView, Keymap, Menu, Platform, TFile, WorkspaceLeaf } from "obsidian";
import { geoNaturalEarth1, geoPath, type GeoPermissibleObjects, type GeoProjection } from "d3-geo";
import { select, type Selection } from "d3-selection";
import { zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
import worldData from "../../data/countries-110m.json";
import type PlaceNotesPlugin from "../main";
import type { LocatedNote } from "../index";
import { countryByCode } from "../countries";

export const VIEW_TYPE_MAP = "place-notes-map";

interface CountryProps {
  name: string;
  iso: string | null;
}

type CountryFeature = Feature<Geometry, CountryProps>;

const SPHERE: GeoPermissibleObjects = { type: "Sphere" };
const DOT_RADIUS = 4;

const topology = worldData as unknown as Topology<{ countries: GeometryCollection<CountryProps> }>;
const COUNTRIES = feature(topology, topology.objects.countries);

export class PlaceMapView extends ItemView {
  private svg!: Selection<SVGSVGElement, unknown, null, undefined>;
  private root!: Selection<SVGGElement, unknown, null, undefined>;
  private countriesLayer!: Selection<SVGGElement, unknown, null, undefined>;
  private dotsLayer!: Selection<SVGGElement, unknown, null, undefined>;
  private tooltip!: HTMLElement;
  private emptyHint!: HTMLElement;
  private projection: GeoProjection = geoNaturalEarth1();
  private zoomBehavior!: ZoomBehavior<SVGSVGElement, unknown>;
  private transform: ZoomTransform = zoomIdentity;
  private size = { width: 0, height: 0 };

  constructor(
    leaf: WorkspaceLeaf,
    private plugin: PlaceNotesPlugin,
  ) {
    super(leaf);
    this.navigation = false;
  }

  getViewType(): string {
    return VIEW_TYPE_MAP;
  }

  getDisplayText(): string {
    return "Places";
  }

  override getIcon(): string {
    return "map";
  }

  override async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("place-notes-map-container");

    this.svg = select(container).append("svg").attr("class", "place-notes-map");
    this.root = this.svg.append("g");
    this.root.append("path").attr("class", "place-notes-sphere").datum(SPHERE);
    this.countriesLayer = this.root.append("g");
    this.dotsLayer = this.root.append("g");
    this.tooltip = container.createDiv({ cls: "place-notes-tooltip" });
    this.tooltip.hide();
    this.emptyHint = container.createDiv({
      cls: "place-notes-empty-hint",
      text: "No place notes yet. Tap a country, or press +.",
    });

    const action = this.addAction("plus", "New place note", () => this.plugin.newPlace());
    action.addClass("place-notes-new-note-action");
    action.createSpan({ cls: "place-notes-new-note-label", text: "New place note" });

    this.countriesLayer
      .selectAll<SVGPathElement, CountryFeature>("path")
      .data(COUNTRIES.features)
      .join("path")
      .attr("class", "place-notes-country")
      .attr("data-iso", (d) => d.properties.iso ?? "")
      .on("click", (event: MouseEvent, d) => this.showCountryMenu(event, d));

    this.zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 40])
      .on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        this.transform = event.transform;
        this.root.attr("transform", this.transform.toString());
        this.dotsLayer.selectAll("circle").attr("r", DOT_RADIUS / this.transform.k);
        this.hideTooltip();
      });
    this.svg.call(this.zoomBehavior);

    this.registerEvent(this.plugin.index.on("changed", () => this.refresh()));
    this.layout();
    this.refresh();
  }

  override onResize(): void {
    this.layout();
  }

  override async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  /** Fits the projection to the current pane size and redraws geometry. */
  private layout(): void {
    const width = this.contentEl.clientWidth;
    const height = this.contentEl.clientHeight;
    if (!width || !height) {
      this.contentEl.win.requestAnimationFrame(() => this.layout());
      return;
    }
    if (width === this.size.width && height === this.size.height) return;
    this.size = { width, height };

    this.svg.attr("viewBox", `0 0 ${width} ${height}`);
    this.projection.fitSize([width, height], SPHERE);
    this.zoomBehavior.translateExtent([
      [0, 0],
      [width, height],
    ]);

    const path = geoPath(this.projection);
    this.root.select<SVGPathElement>(".place-notes-sphere").attr("d", path(SPHERE));
    this.countriesLayer.selectAll<SVGPathElement, CountryFeature>("path").attr("d", (d) => path(d));
    this.placeDots();
  }

  /** Re-applies index data: country shading and dots. */
  private refresh(): void {
    const index = this.plugin.index;
    this.emptyHint.toggle(index.isEmpty());
    this.countriesLayer
      .selectAll<SVGPathElement, CountryFeature>("path")
      .classed("is-visited", (d) => d.properties.iso !== null && index.notesFor(d.properties.iso).length > 0);

    this.dotsLayer
      .selectAll<SVGCircleElement, LocatedNote>("circle")
      .data(index.located, (d) => d.file.path)
      .join("circle")
      .attr("class", "place-notes-dot")
      .attr("r", DOT_RADIUS / this.transform.k)
      .on("click", (event: MouseEvent, d) => {
        event.stopPropagation();
        this.hideTooltip();
        void this.openNote(d.file, event);
      })
      .on("pointerenter", (event: PointerEvent, d) => this.showTooltip(event, d.file.basename))
      .on("pointermove", (event: PointerEvent) => this.moveTooltip(event))
      .on("pointerleave", () => this.hideTooltip());
    this.placeDots();
  }

  private placeDots(): void {
    this.dotsLayer
      .selectAll<SVGCircleElement, { lat: number; lon: number }>("circle")
      .each((d, i, nodes) => {
        const p = this.projection([d.lon, d.lat]);
        const el = nodes[i];
        if (p) {
          el.setAttribute("cx", String(p[0]));
          el.setAttribute("cy", String(p[1]));
          el.removeAttribute("display");
        } else {
          el.setAttribute("display", "none");
        }
      });
  }

  private showCountryMenu(event: MouseEvent, d: CountryFeature): void {
    const iso = d.properties.iso;
    const name = (iso && countryByCode(iso)?.name) || d.properties.name;
    const notes = iso ? this.plugin.index.notesFor(iso) : [];

    const menu = new Menu();
    if (iso) {
      menu.addItem((item) =>
        item
          .setTitle(`New place note in ${name}…`)
          .setIcon("plus")
          .onClick(() => this.plugin.newPlace(iso)),
      );
    }
    menu.addSeparator();
    if (notes.length === 0) {
      menu.addItem((item) => item.setTitle("No notes yet").setDisabled(true));
    }
    for (const file of notes) {
      menu.addItem((item) =>
        item
          .setTitle(file.basename)
          .setIcon("file-text")
          .onClick((evt) => void this.openNote(file, evt)),
      );
    }
    menu.showAtMouseEvent(event);
  }

  private async openNote(file: TFile, evt: MouseEvent | KeyboardEvent): Promise<void> {
    const leaf = this.app.workspace.getLeaf(Keymap.isModEvent(evt));
    await leaf.openFile(file);
  }

  private showTooltip(event: PointerEvent, text: string): void {
    if (Platform.isMobile) return;
    this.tooltip.setText(text);
    this.tooltip.show();
    this.moveTooltip(event);
  }

  private moveTooltip(event: PointerEvent): void {
    if (this.tooltip.isShown() === false) return;
    const rect = this.contentEl.getBoundingClientRect();
    this.tooltip.style.left = `${event.clientX - rect.left + 12}px`;
    this.tooltip.style.top = `${event.clientY - rect.top + 12}px`;
  }

  private hideTooltip(): void {
    this.tooltip.hide();
  }
}
