import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateInvoiceRequestDto } from './dto/create-invoice-request.dto';
import { UpdateInvoiceRequestDto } from './dto/update-invoice-request.dto';
import { InvoiceRepository } from 'src/db/repositories/invoice.repository';
import { Invoice, UserOrganizationInvoice } from 'src/db/entities';
import {
  InvoiceResponseListDto,
  InvoiceResponseDto,
} from './dto/invoice-response.dto';
import { InvoiceSearchRequestDto } from './dto/invoice-search-request.dto';

@Injectable()
export class InvoicesService {
  constructor(private readonly invoiceRepository: InvoiceRepository) {}

  async create(
    organizationId: number,
    request: CreateInvoiceRequestDto,
  ): Promise<Invoice> {
    const { name, note, amount, date, type } = request;

    // Create invoice
    const invoice = new Invoice();
    invoice.name = name;
    invoice.note = note || null;
    invoice.amount = amount;
    invoice.date = date;
    invoice.type = type;
    invoice.organizationId = organizationId;

    await this.invoiceRepository.manager.transaction(async (manager) => {
      await manager.save(Invoice, invoice);
    });

    return invoice;
  }

  async findAll(
    organizationId: number,
    search: InvoiceSearchRequestDto,
  ): Promise<InvoiceResponseListDto> {
    const invoices = await this.invoiceRepository.findInvoicesForOrganization(
      organizationId,
      search,
    );

    const invoiceDtos = invoices.map(
      (invoice) => new InvoiceResponseDto(invoice),
    );

    const result = new InvoiceResponseListDto();
    result.invoices = invoiceDtos;
    result.metadata = {
      total: invoiceDtos.length,
      params: search,
    };

    return result;
  }

  async findOne(organizationId: number, invoiceId: number): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { organizationId, id: invoiceId },
    });
    if (!invoice) {
      throw new NotFoundException(
        `Invoice ${invoiceId} does not belong to the organization ${organizationId}`,
      );
    }

    return invoice;
  }

  async update(
    organizationId: number,
    invoiceId: number,
    req: UpdateInvoiceRequestDto,
  ) {
    const { name, note, amount, date, type } = req;
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId, organizationId },
    });

    if (!invoice) {
      throw new NotFoundException(
        `Invoice ${invoiceId} does not belong to the organization ${organizationId}`,
      );
    }

    if (name) invoice.name = name;
    if (note) invoice.note = note;
    if (amount) invoice.amount = amount;
    if (date) invoice.date = date;
    if (type) invoice.type = type;

    return await invoice.save();
  }

  async delete(organizationId: number, invoiceId: number): Promise<void> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId, organizationId },
    });

    if (!invoice) {
      throw new NotFoundException(
        `Invoice ${invoiceId} doesn't belong to organization ${organizationId}`,
      );
    }

    await this.invoiceRepository.manager.transaction(async (manager) => {
      const deletePromises = [];

      deletePromises.push(
        manager.delete(UserOrganizationInvoice, { organizationId, invoiceId }),
      );
      deletePromises.push(manager.delete(Invoice, { id: invoiceId }));

      await Promise.all(deletePromises);
    });
  }
}