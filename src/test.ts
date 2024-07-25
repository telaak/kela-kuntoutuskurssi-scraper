import { KurssiParser } from "./parser";

const parser = new KurssiParser()

parser.parseCourseDetails('87606').then(console.log)