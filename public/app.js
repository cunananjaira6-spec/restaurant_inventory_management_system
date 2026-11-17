const itemDialog = document.getElementById("add-item-dialog");
const itemForm = document.getElementById("item-form");

document.querySelectorAll("[data-open-dialog]").forEach(button => {
  button.addEventListener("click", () => {
    if (!itemDialog || !itemForm) return;
    itemForm.reset();
    itemForm.action = "/inventory/add";
    document.getElementById("dialog-title").textContent = "Add a product";
    document.getElementById("dialog-eyebrow").textContent = "NEW STOCK";
    document.getElementById("dialog-submit").textContent = "Save product";
    itemDialog.showModal();
  });
});

document.querySelectorAll("[data-edit-item]").forEach(button => {
  button.addEventListener("click", () => {
    if (!itemDialog || !itemForm) return;
    itemForm.action = `/inventory/${button.dataset.id}/update`;
    itemForm.elements.name.value = button.dataset.name;
    itemForm.elements.quantity.value = button.dataset.quantity;
    itemForm.elements.unitPrice.value = button.dataset.unitPrice;
    itemForm.elements.categoryId.value = button.dataset.categoryId;
    itemForm.elements.reorderLevel.value = button.dataset.reorderLevel;
    itemForm.elements.unit.value = button.dataset.unit;
    document.getElementById("dialog-title").textContent = "Edit product";
    document.getElementById("dialog-eyebrow").textContent = "UPDATE STOCK";
    document.getElementById("dialog-submit").textContent = "Save changes";
    itemDialog.showModal();
  });
});

document.querySelectorAll("[data-close-dialog]").forEach(button => {
  button.addEventListener("click", () => itemDialog?.close());
});

document.querySelectorAll("[data-confirm-delete]").forEach(form => {
  form.addEventListener("submit", event => {
    if (!window.confirm(`Remove "${form.dataset.confirmDelete}" from your inventory?`)) {
      event.preventDefault();
    }
  });
});
