import axios from "axios";
import { JSDOM } from "jsdom";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import dayjs, { Dayjs } from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
dayjs.extend(customParseFormat);
import { URLSearchParams } from "url";
import iconv from "iconv-lite";

export type Course = {
  id: string;
  name: string;
  illness: string;
  targetGroup: string;
  kind: string;
  type: string;
  startDate: Date | Dayjs;
  area: string;
  spotsAvailable: number;
  patientArea?: string | null;
  patientAreaDescription?: string;
};

export class KurssiParser {
  private jar = new CookieJar();
  private client = wrapper(
    axios.create({
      jar: this.jar,
      withCredentials: true,
      responseType: "arraybuffer",
      responseEncoding: "binary",
    })
  );

  public courses: Course[] = [];

  public url =
    "https://kuntoutus.kela.fi/kurssihaku/KZInternetApplication/YleiskyselyHakuUseCase";

  async getCourses(
    startDate: Date | Dayjs,
    endDate: Date | Dayjs,
    language: string = "null",
    searchTerm: string = "",
    type: string = "SAIRA",
    courseLanguage: string = "S",
    illness: string = "",
    profession: string = "",
    area: string = "",
    jobStatus: string = "",
    targetGroup: string = "",
    spotsAvailable: string = ""
  ) {
    const params = new URLSearchParams();
    params.append("yleiskysely_hae", "Suorita haku  ");
    params.append("<csrf:tokenname/>", "<csrf:tokenvalue/>");

    params.append("lang", language);
    params.append("yleiskysely_alpv", dayjs(startDate).format("DD.MM.YYYY"));
    params.append("yleiskysely_lopv", dayjs(endDate).format("DD.MM.YYYY"));
    params.append("yleiskysely_hakusana", searchTerm);
    params.append("yleiskysely_tyyppi", type);
    params.append("yleiskysely_kukieli", courseLanguage);
    params.append("yleiskysely_sairaus", illness);
    params.append("yleiskysely_ammatti", profession);
    params.append("yleiskysely_alue", area);
    params.append("yleiskysely_tyoti", jobStatus);
    params.append("yleiskysely_aikulanu", targetGroup);
    params.append("yleiskysely_paikkatil", spotsAvailable);

    const response = await this.client.post(this.url, params);
    const data = iconv.decode(response.data, "ISO-8859-1");
    const { document } = new JSDOM(data).window;

    this.courses.push(...this.parseTable(document));

    await this.getNextPage();

    return this.courses;
  }

  async getNextPage() {
    const params = new URLSearchParams();
    params.append("luettelo_sivu", "seuraava");
    params.append("lang", "fi");

    const response = await this.client.post(this.url, params);
    const data = iconv.decode(response.data, "ISO-8859-1");
    const { document } = new JSDOM(data).window;

    const parsedTable = this.parseTable(document);
    this.courses.push(...parsedTable);

    const hasNext = Array.from(document.querySelectorAll("a")).find(
      (n) => n.textContent && n.textContent.includes("Seuraava sivu")
    );

    if (hasNext) {
      await this.getNextPage();
    }
  }

  parseTable(document: Document) {
    const courseTable = document.querySelector(
      "form > table"
    ) as HTMLTableElement;
    const rows = courseTable.querySelectorAll("tr");
    const rowArray = Array.from(rows);
    const courses = rowArray.slice(2, rowArray.length - 3);
    const mappedCourses = courses.map((c) => this.parseCourse(c));

    return mappedCourses;
  }

  parseNameCell(cell: HTMLTableCellElement) {
    const anchorElement = cell.querySelector("a") as HTMLAnchorElement;
    const text = anchorElement.textContent as string;
    return text.trim();
  }

  parseCourse(course: HTMLTableRowElement): Course {
    const cells = course.querySelectorAll("td");
    const cellArray = Array.from(cells);
    const id = this.parseCell(cellArray[0]);
    const name = this.parseNameCell(cells.item(1));
    const illness = this.parseCell(cells.item(2));
    const targetGroup = this.parseCell(cells.item(3));
    const kind = this.parseCell(cells.item(4));
    const type = this.parseCell(cells.item(5));
    const startDate = dayjs(this.parseCell(cells.item(6)), "DD.MM.YYYY");
    const area = this.parseCell(cells.item(7));
    const spotsAvailable = Number(this.parseCell(cells.item(8)));

    return {
      id,
      name,
      illness,
      targetGroup,
      kind,
      type,
      startDate,
      area,
      spotsAvailable,
    };
  }

  getAllComments(node: HTMLParagraphElement, dom: JSDOM) {
    const nodeIterator = dom.window.document.createNodeIterator(
      node,
      dom.window.NodeFilter.SHOW_COMMENT,
      (node) => dom.window.NodeFilter.FILTER_ACCEPT
    );

    const comments = [];
    let currentNode: Node | null;

    while ((currentNode = nodeIterator.nextNode())) {
      comments.push(currentNode);
    }
    return comments as Text[];
  }

  async parseCourseDetails(courseId: string) {
    const response = await this.client.get(
      `${this.url}?valittu=${courseId}&lang=fi`
    );
    const data = iconv.decode(response.data, "ISO-8859-1");
    const jsDom = new JSDOM(data);
    const { document } = jsDom.window;

    const paragraph = document.querySelector(
      "p:not([class])"
    ) as HTMLParagraphElement;

    const comments = this.getAllComments(paragraph, jsDom);

    const anchors = paragraph.querySelectorAll("a");
    const anchorArray = Array.from(anchors);

    const areaNode = anchorArray.find((n) => n.getAttribute("href") === "#");

    const areaDescriptionComment = comments.find((n) =>
      n.data.includes("Alueet,")
    ) as Text;
    const areaDescription =
      areaDescriptionComment!.nextSibling!.nextSibling!.nextSibling!.nextSibling!.nextSibling!.textContent!.trim();

    return {
      patientArea: areaNode ? areaNode!.textContent!.trim() : null,
      patientAreaDescription: areaDescription,
    };
  }

  parseCell(cell: HTMLTableCellElement) {
    const text = cell.textContent as string;
    const trimmed = text.trim();
    return trimmed;
  }
}
