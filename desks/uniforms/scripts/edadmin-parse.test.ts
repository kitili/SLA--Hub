import assert from "node:assert/strict";
import test from "node:test";
import {
  parseEdadminParents,
  parseEdadminStudents,
  parseEdadminXmlRecords,
  parseStudentClasses,
} from "../src/lib/edadmin/parse";

test("parseEdadminXmlRecords extracts Students blocks", () => {
  const xml = `<root><Students><ID>1</ID><AdmNo>SLA/UR/2023/312</AdmNo><FirstName>Amina</FirstName><ParentID>99</ParentID></Students></root>`;
  const rows = parseEdadminXmlRecords(xml, "Students");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].AdmNo, "SLA/UR/2023/312");
  assert.equal(rows[0].ParentID, "99");
});

test("parseEdadminStudents maps AdmNo to regNo and ParentID", () => {
  const students = parseEdadminStudents([
    {
      ID: "1",
      AdmNo: "SLA/UR/2023/312",
      FirstName: "Amina",
      LastName: "Juma",
      ParentID: "99",
      Gender: "F",
      CampusName: "Usa River",
    },
  ]);
  assert.equal(students.length, 1);
  assert.equal(students[0].regNo, "SLA/UR/2023/312");
  assert.equal(students[0].parentEdadminId, "99");
});

test("parseEdadminParents reads parent ID and phone", () => {
  const parents = parseEdadminParents([
    { ID: "99", MotherFName: "Mary", MotherLName: "Juma", MPCell: "0755123456" },
  ]);
  assert.equal(parents[0].edadminId, "99");
  assert.equal(parents[0].phone, "0755123456");
});

test("parseStudentClasses builds grade class label", () => {
  const map = parseStudentClasses([{ StudentID: "1", Grade: "4", Class: "P4" }]);
  assert.equal(map.get("1"), "4 P4");
});
