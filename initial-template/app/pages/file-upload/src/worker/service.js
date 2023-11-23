export default class Service {
  #url;

  constructor({ url }) {
    this.#url = url;
  }

  async uploadFile({ filename, fileBuffer }) {
    // Fazer o upload a partir do navegador para o servidor.
    const formData = new FormData();
    formData.append(filename, fileBuffer);
    console.log("uploading file", filename);

    const response = await fetch(`${this.#url}/upload`, {
      method: "POST",
      body: formData,
    });

    console.assert(response.ok, "response is not ok", response);
    return response;
  }

  async makeWebmFile({ filename }) {
    const response = await fetch(`${this.#url}/makewebmfile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filename }),
    });

    console.assert(response.ok, "response is not ok", response);
    return response;
  }
}
