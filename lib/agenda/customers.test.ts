import { beforeEach, expect, test } from "bun:test"
import { createOrganization, resetDatabase } from "@/test/fixtures"
import { createCustomer, findCustomer, listCustomers } from "./customers"

beforeEach(resetDatabase)

test("lists only the organization's customers, matching the search", async () => {
  const [ana] = await createOrganization("Ana")
  const [other] = await createOrganization("Outra")
  await createCustomer(ana, { name: "Carla Souza" })
  await createCustomer(ana, { name: "Beatriz Lima" })
  await createCustomer(other, { name: "Carla Dias" })

  expect((await listCustomers(ana)).map((row) => row.name)).toEqual(["Beatriz Lima", "Carla Souza"])
  expect((await listCustomers(ana, "carla")).map((row) => row.name)).toEqual(["Carla Souza"])
  expect(await listCustomers(ana, "100%")).toEqual([])
})

test("finds a customer only inside the organization", async () => {
  const [ana] = await createOrganization("Ana")
  const [other] = await createOrganization("Outra")
  const carla = await createCustomer(ana, { name: "Carla" })
  expect(await findCustomer(ana, carla.id)).toEqual(carla)
  expect(await findCustomer(other, carla.id)).toBeUndefined()
})
