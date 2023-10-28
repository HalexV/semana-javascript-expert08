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

    const response = await fetch(this.#url, {
      method: "POST",
      body: formData,
    });

    console.assert(response.ok, "response is not ok", response);
    return response;
  }
}
